import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelCredentialCipher } from "../apps/server/dist/model-credential-cipher.js";
import { PostgresModelConnectionStore } from "../apps/server/dist/postgres-model-connection-store.js";

/** Runs only inside the existing disposable *_test database verifier; no provider is contacted. */
export async function verifyModelConnections(first, second) {
  const cipher = ModelCredentialCipher.fromKey(randomBytes(32));
  const store = new PostgresModelConnectionStore(first.db, cipher);
  const competing = new PostgresModelConnectionStore(second.db, cipher);
  const prefix = `Model connection test ${randomUUID()}`;
  const ids = [];
  const secrets = [
    "test-model-connection-key-one",
    "test-model-connection-key-two",
    "test-model-connection-key-rotated",
  ];
  const initial = await store.list();
  assert.ok(initial.length <= 29, "Disposable registry must leave at least three fixture slots");
  const create = async (index, target = store) => {
    const connection = await target.create({
      name: `${prefix} ${index}`,
      presetId: "deepseek",
      baseUrl: "https://api.deepseek.com",
      protocol: "openai-chat",
      apiKey: secrets[index === 0 ? 0 : 1],
    });
    ids.push(connection.id);
    return connection;
  };

  try {
    const firstConnection = await create(0);
    const secondConnection = await create(1);
    assert.equal(await PostgresModelConnectionStore.hasAny(first.db), true);
    assert.equal((await store.get(firstConnection.id)).apiKey, secrets[0]);
    assert.equal(await store.get(randomUUID()), undefined);
    const [stored] = await first.client`
      select encrypted_api_key from model_connections where id = ${firstConnection.id}
    `;
    assert.ok(stored.encrypted_api_key.startsWith("v1."));
    for (const secret of secrets) {
      assert.ok(!JSON.stringify(await store.list()).includes(secret));
      assert.ok(!JSON.stringify(firstConnection).includes(secret));
      assert.ok(!stored.encrypted_api_key.includes(secret));
    }
    const lostKeyDirectory = await mkdtemp(join(tmpdir(), "openbot-model-key-missing-"));
    try {
      await assert.rejects(
        ModelCredentialCipher.load(join(lostKeyDirectory, "missing-key"), {
          allowCreate: !(await PostgresModelConnectionStore.hasAny(first.db)),
        }),
        /original protected key file/,
      );
    } finally {
      await rm(lostKeyDirectory, { recursive: true, force: true });
    }

    const updates = await Promise.allSettled([
      store.update(firstConnection.id, { expectedRevision: 1, name: `${prefix} winner-one` }),
      competing.update(firstConnection.id, { expectedRevision: 1, name: `${prefix} winner-two` }),
    ]);
    assert.equal(updates.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(updates.filter((result) => result.status === "rejected").length, 1);
    await assert.rejects(
      store.update(firstConnection.id, { expectedRevision: 1, enabled: false }),
      /changed/,
    );
    const rotated = await store.update(firstConnection.id, {
      expectedRevision: 2,
      apiKey: secrets[2],
    });
    assert.equal(rotated.revision, 3);
    assert.equal((await competing.get(firstConnection.id)).apiKey, secrets[2]);
    await assert.rejects(
      store.update(firstConnection.id, {
        expectedRevision: 3,
        baseUrl: "https://elsewhere.example",
        name: "Invalid endpoint edit",
      }),
      /invalid/,
    );
    await assert.rejects(
      store.update(firstConnection.id, {
        expectedRevision: 3,
        presetId: "openai",
        enabled: false,
      }),
      /invalid/,
    );
    await assert.rejects(
      store.update(firstConnection.id, {
        expectedRevision: 3,
        protocol: "anthropic-messages",
        enabled: false,
      }),
      /invalid/,
    );
    assert.equal((await store.get(firstConnection.id)).connection.revision, 3);

    const [beforeSwap] = await first.client`
      select encrypted_api_key from model_connections where id = ${secondConnection.id}
    `;
    await first.client`
      update model_connections set encrypted_api_key = ${stored.encrypted_api_key}
      where id = ${secondConnection.id}
    `;
    await assert.rejects(store.get(secondConnection.id), /credential is unavailable/);
    assert.ok((await store.list()).some((item) => item.id === secondConnection.id));
    await store.update(secondConnection.id, { expectedRevision: 1, enabled: false });
    await assert.rejects(store.get(secondConnection.id), /disabled/);
    await first.client`
      update model_connections set encrypted_api_key = ${beforeSwap.encrypted_api_key}
      where id = ${secondConnection.id}
    `;
    await store.update(secondConnection.id, { expectedRevision: 2, enabled: true });
    assert.equal((await store.get(secondConnection.id)).apiKey, secrets[1]);

    const audit = await first.client`
      select type, payload from run_events
      where payload->>'id' = any(${ids}) and type like 'MODEL_CONNECTION_%'
    `;
    assert.equal(audit.filter((event) => event.type === "MODEL_CONNECTION_CREATED").length, 2);
    assert.equal(audit.filter((event) => event.type === "MODEL_CONNECTION_UPDATED").length, 4);
    for (const event of audit) {
      const allowed =
        event.type === "MODEL_CONNECTION_CREATED"
          ? ["id", "presetId", "revision"]
          : ["changedFields", "id", "presetId", "revision"];
      assert.deepEqual(Object.keys(event.payload).sort(), allowed);
      assert.ok(!JSON.stringify(event).includes(prefix));
      for (const secret of secrets) assert.ok(!JSON.stringify(event).includes(secret));
    }

    const remaining = 31 - (await store.list()).length;
    for (let index = 0; index < remaining; index++) await create(index + 2);
    const atCapacity = await Promise.allSettled([
      create(40),
      create(41, competing),
      create(42),
      create(43, competing),
    ]);
    assert.equal(atCapacity.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(atCapacity.filter((result) => result.status === "rejected").length, 3);
    const [count] = await first.client`select count(*)::int as total from model_connections`;
    assert.equal(count.total, 32);
    console.info(
      "Model connection verification passed: encrypted persistence, isolated credentials, revisions, disabled access, content-free audit, and concurrent capacity.",
    );
  } finally {
    if (ids.length) {
      await first.client`delete from run_events where payload->>'id' = any(${ids}) and type like 'MODEL_CONNECTION_%'`;
      await first.client`delete from model_connections where id = any(${ids})`;
    }
  }
}
