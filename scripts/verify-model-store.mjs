import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresControlPlaneStore } from "../apps/server/dist/postgres-store.js";

/** Called only by the existing disposable *_test database verifier. No model API is invoked. */
export async function verifyModelStore(first, second) {
  const store = new PostgresControlPlaneStore(first.db);
  const competing = new PostgresControlPlaneStore(second.db);
  const suffix = randomUUID();
  const botIds = [];
  const channelIds = [];
  try {
    for (const profile of ["model", "model", "docker-linux"]) {
      const bot = await store.createBot({
        name: `Model store ${botIds.length} ${suffix}`,
        role: "Disposable model test",
        computerProfile: profile,
        ...(botIds.length === 0
          ? { model: { connectionId: "legacy-kimi", modelId: "initial/model" } }
          : {}),
      });
      botIds.push(bot.id);
    }
    for (let index = 0; index < 2; index++) {
      const channel = await store.createChannel({
        name: `Model channel ${index} ${suffix}`,
        description: "",
        botIds,
      });
      channelIds.push(channel.id);
    }
    const submit = (content, botId = botIds[0], channelId = channelIds[0]) =>
      store.submitTask(channelId, { content, botId });
    const firstTask = await submit("Remember orange.");
    assert.deepEqual(firstTask.run.model, {
      connectionId: "legacy-kimi",
      modelId: "initial/model",
    });
    const rebound = await store.updateEmployeeModel(botIds[0], {
      expectedRevision: 1,
      model: { connectionId: "legacy-kimi", modelId: "next/model" },
    });
    assert.equal(rebound.details.revision, 2);
    assert.deepEqual(
      (await store.getEmployeeProfile(botIds[0])).configuration.model,
      rebound.employee.model,
    );
    assert.deepEqual(
      (await store.listModelRuns()).find((run) => run.id === firstTask.run.id).model,
      { connectionId: "legacy-kimi", modelId: "initial/model" },
      "Queued selection is immutable after rebinding",
    );
    await assert.rejects(
      store.updateEmployeeModel(botIds[0], { expectedRevision: 1, model: null }),
    );
    await assert.rejects(
      store.updateEmployeeModel(botIds[2], { expectedRevision: 1, model: null }),
    );
    await assert.rejects(
      store.createBot({
        name: `Invalid binding ${suffix}`,
        role: "Disposable model test",
        computerProfile: "model",
        model: { connectionId: randomUUID(), modelId: "model" },
      }),
    );
    assert.equal(await store.assignRun(firstTask.run.id, "untrusted-node"), undefined);
    const claims = await Promise.all([
      store.claimModelRun(firstTask.run.id),
      competing.claimModelRun(firstTask.run.id),
    ]);
    assert.equal(claims.filter(Boolean).length, 1, "Only one Server may claim a model Run");
    assert.equal(
      await store.completeRun(firstTask.run.id, "untrusted-node", "unauthorized", []),
      undefined,
    );
    assert.equal(
      await store.failRun(firstTask.run.id, "untrusted-node", "unauthorized"),
      undefined,
    );
    await store.recordModelToolEvent(firstTask.run.id, "web_search", "started");
    await store.recordModelToolEvent(firstTask.run.id, "web_search", "completed");
    const audit =
      await first.client`select payload from run_events where run_id = ${firstTask.run.id} and type = 'MODEL_WEB_TOOL' order by created_at`;
    assert.deepEqual(
      audit.map((row) => row.payload),
      [
        { tool: "web_search", phase: "started" },
        { tool: "web_search", phase: "completed" },
      ],
    );
    const completed = await store.completeModelRun(firstTask.run.id, "I will remember orange.");
    await assert.rejects(store.recordModelToolEvent(firstTask.run.id, "fetch", "started"));
    assert.equal(completed.run.status, "completed");
    assert.equal(completed.run.nodeId, undefined);
    assert.equal(completed.message.authorId, botIds[0]);
    assert.equal(completed.message.replyToMessageId, firstTask.message.id);
    assert.equal(await store.completeModelRun(firstTask.run.id, "duplicate"), undefined);
    assert.equal(
      (await store.listMessages(channelIds[0])).filter(
        (message) => message.runId === firstTask.run.id && message.authorType === "bot",
      ).length,
      1,
    );

    for (const task of [
      await submit("Other employee secret", botIds[1]),
      await submit("Other channel secret", botIds[0], channelIds[1]),
    ]) {
      await store.claimModelRun(task.run.id);
      await store.completeModelRun(task.run.id, "Excluded private exchange");
    }
    const followup = await submit("What word?");
    assert.deepEqual(followup.run.model, { connectionId: "legacy-kimi", modelId: "next/model" });
    const context = await store.getModelInput(followup.run);
    assert.deepEqual(context.history, [
      { instruction: "Remember orange.", reply: "I will remember orange." },
    ]);
    const browserTask = await submit("Open https://example.com", botIds[2]);
    assert.equal(await store.claimModelRun(browserTask.run.id), undefined);
    assert.equal(await store.completeModelRun(browserTask.run.id, "unauthorized"), undefined);
    assert.equal(await store.failModelRun(browserTask.run.id, "unauthorized"), undefined);
    assert.ok(
      (await store.listDispatchableRuns()).every((run) => run.executionProfile !== "model"),
    );
    assert.ok((await store.listModelRuns()).every((run) => run.executionProfile === "model"));
    await store.claimModelRun(followup.run.id);
    await assert.rejects(store.completeModelRun(followup.run.id, "x".repeat(16_001)));
    assert.equal(
      (await store.failModelRun(followup.run.id, "Controlled failure")).status,
      "failed",
    );

    for (let index = 0; index < 11; index++) {
      const task = await submit(`Long exchange ${index}`);
      await store.claimModelRun(task.run.id);
      await store.completeModelRun(task.run.id, "x".repeat(15_900));
    }
    const last = await submit("Bounded history");
    const bounded = await store.getModelInput(last.run);
    assert.ok(bounded.history.length <= 10);
    assert.ok(JSON.stringify(bounded.history).length <= 24_000);
    assert.ok(!JSON.stringify(bounded).includes("Other employee secret"));
    await store.claimModelRun(last.run.id);
    assert.ok(
      (await store.failRunningRuns()).some(
        (run) => run.id === last.run.id && run.status === "failed",
      ),
    );
    console.info(
      "Model store verification passed: claims, ownership, atomic replies, context isolation/bounds, failures, and recovery.",
    );
  } finally {
    if (botIds.length) {
      await first.client`delete from run_events where bot_id = any(${botIds}) or channel_id = any(${channelIds})`;
      // Both directions of the message/Run link are removed within this disposable fixture.
      await first.client`delete from messages where channel_id = any(${channelIds})`;
      await first.client`delete from runs where bot_id = any(${botIds})`;
      await first.client`delete from channel_bots where bot_id = any(${botIds})`;
      await first.client`delete from channels where id = any(${channelIds})`;
      await first.client`delete from bots where id = any(${botIds})`;
    }
  }
}
