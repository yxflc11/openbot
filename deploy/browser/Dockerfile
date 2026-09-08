# Build recipe adapted from CopilotKit/OpenBot agent-computer at 257c1280 (MIT).
# The unmodified runtime and its license are fetched together by archive checksum.
FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e

RUN apt-get update && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"
ENV PATH="/root/.bun/bin:${PATH}"

ADD --checksum=sha256:3c90d2a820ac602af4a3a3bdb2c10b54ad4472770d174a7741acf0dc7b5a6cd6 \
  https://codeload.github.com/CopilotKit/openbot/tar.gz/257c1280d684089be9adb0b35cce262efc7064bf /tmp/upstream.tar.gz
RUN mkdir -p /upstream /app/licenses /profiles /workspace \
  && tar -xzf /tmp/upstream.tar.gz -C /upstream --strip-components=1 \
  && cp -a /upstream/agent-computer/src /app/src \
  && cp /upstream/agent-computer/package.json /upstream/agent-computer/bun.lock /app/ \
  && cp /upstream/LICENSE /app/licenses/CopilotKit-OpenBot.LICENSE \
  && rm -rf /upstream /tmp/upstream.tar.gz
WORKDIR /app
RUN bun install --frozen-lockfile
ENV PORT=4100 PROFILES_DIR=/profiles WORKSPACE_DIR=/workspace
EXPOSE 4100
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 \
  CMD bun -e "const r = await fetch('http://localhost:4100/health'); process.exit(r.ok ? 0 : 1)"
CMD ["bun", "src/index.ts"]
