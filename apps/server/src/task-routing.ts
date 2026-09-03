import type { Bot } from "@openbot/domain";

export type ChannelBotCandidate = Pick<Bot, "id" | "name" | "role">;

export function selectChannelAssignee<Candidate extends ChannelBotCandidate>(
  candidates: Candidate[],
  requestedBotId?: string,
): Candidate | undefined {
  if (requestedBotId !== undefined) {
    return candidates.find((candidate) => candidate.id === requestedBotId);
  }
  return candidates.find(isChief) ?? candidates[0];
}

function isChief(candidate: ChannelBotCandidate): boolean {
  const identity = `${candidate.name} ${candidate.role}`.toLocaleLowerCase();
  return ["chief", "总管", "协调", "调度"].some((marker) => identity.includes(marker));
}
