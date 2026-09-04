<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**Um espaço de trabalho auto-hospedado para trabalhadores digitais multicanal e multiagente.**

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22.22.2+](https://img.shields.io/badge/Node.js-22.22.2%2B-339933.svg)](package.json)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#status-do-projeto)

O OpenBot é uma plataforma auto-hospedada, de código aberto e em estágio inicial para executar
funcionários de IA identificados por nome nos computadores que você controla. O próprio OpenBot é
um agente voltado ao trabalho multicanal e multiagente; ele pode delegar tarefas de escopo limitado
a agentes externos, enquanto o OpenBot Server continua sendo a autoridade sobre identidade,
roteamento, políticas, aprovações, persistência e auditoria.

O produto pretendido tem dois clientes completos. O OpenBot Desktop é o caminho guiado: instale o
mesmo aplicativo em cada computador e habilite qualquer combinação das funções Client, Server e
Worker. O OpenBot Web se conecta ao mesmo espaço de trabalho e também pode ser o cliente principal
para usuários avançados que implantem separadamente os serviços Server, Web, PostgreSQL e Worker.

Um Mac mini é uma opção prática de Worker Host, não o limite do produto. Computadores Windows,
macOS e Linux podem ser, ao mesmo tempo, computadores de uso cotidiano e máquinas de trabalho
autorizadas. O OpenBot se inspira na experiência sempre ativa e baseada em canais de produtos como
o Grok Bot e na experiência de agentes gerenciados pelo navegador do DeepSeek Harness, mantendo-se
auto-hospedado, neutro em relação a provedores, extensível e projetado para controle humano
explícito.

> [!WARNING]
> O OpenBot é um código-fonte em estágio pre-alpha, não o produto Desktop concluído descrito
> abaixo. O provedor de computador atual é somente leitura e **não** preenche, clica, envia nem
> controla contas de produção. Não conecte formas de pagamento, contas principais ou credenciais
> de produção. Leia [Segurança](#segurança) antes de expor uma implantação.

## Por que o OpenBot

- **Canais locais, não janelas de conversa descartáveis.** Bots, conversas, Runs e resultados
  persistem no seu próprio banco de dados PostgreSQL.
- **Computadores substituíveis e multiplataforma.** Um funcionário é uma identidade e uma política
  persistentes; um Worker Host pode ser um dispositivo Windows, macOS, Linux, uma VM, um contêiner
  ou um dispositivo gerenciado, e pode ser substituído.
- **Funcionários que crescem e podem ser transferidos.** Cada funcionário tem um histórico de
  evolução baseado em evidências, um grafo de habilidades, um registro de decisões, memória,
  histórico de trabalho, configuração e controles seguros de portabilidade.
- **Aprovação antes de efeitos colaterais.** Ações sensíveis entram em um estado de aprovação
  explícito e auditável. Os modelos não podem conceder privilégios adicionais a si mesmos.
- **Um espaço de trabalho no Desktop ou na Web.** Ambos os clientes usam os mesmos canais, agentes,
  tarefas, aprovações, dispositivos, plugins e histórico controlados pelo Server.
- **Funções combináveis em cada computador.** A mesma instalação do Desktop pode atuar como
  Client, hospedar o Server, executar o serviço Worker ou combinar essas funções.
- **OpenBot nativo e agentes externos.** O OpenBot continua sendo o agente coordenador e pode
  delegar trabalhos de escopo limitado ao Hermes, Pi, OpenClaw e a adaptadores futuros.
- **Extensões abertas sem autoautorização.** Plugins podem alterar a apresentação ou adicionar
  ferramentas, canais, agentes e automações, mas somente o Server pode conceder autoridade.
- **Identidades de Bot combináveis.** A aparência do Bot é armazenada em cinco camadas
  independentes: cabeça, corpo, mobilidade, acessório e cor de destaque.
- **Adaptadores em vez de aprisionamento tecnológico.** Modelos, ambientes de execução de
  computador e projetos upstream se conectam por limites tipados e versionados.

A direção de evolução e aprendizado dos funcionários é explicitamente inspirada no
[learning graph do Hermes Agent](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py).
O OpenBot mantém seu próprio modelo de evidências, revisão, permissões e portabilidade sob controle
do Server; ele não apresenta o conceito de learning graph como uma invenção do OpenBot.

## Modelo do produto pretendido

> [!NOTE]
> Esta seção define a direção de produto aceita. Ela não afirma que o Desktop, a instalação guiada
> de serviços, os adaptadores de agentes externos ou a plataforma de plugins estejam disponíveis
> hoje.

| Caminho de entrada | Experiência pretendida |
| --- | --- |
| OpenBot Desktop | O cliente completo recomendado para macOS, Windows e Linux, com orientação para criação e conexão do espaço de trabalho, instalação de serviços, permissões, diagnóstico e recuperação. |
| OpenBot Web | Um cliente completo no navegador para acesso remoto ao mesmo espaço de trabalho, ou o cliente principal de uma implantação modular auto-hospedada. |
| Auto-hospedagem modular | Um caminho avançado que instala Server, Web, PostgreSQL e um ou mais serviços Worker separadamente, sem exigir o Desktop. |

As funções do Desktop são capacidades, não edições separadas:

| Função | Responsabilidade |
| --- | --- |
| Client | Canais, mensagens, tarefas, aprovações, configurações e observação. |
| Server | Fonte de verdade do espaço de trabalho, identidade, roteamento, políticas, aprovações, persistência e auditoria. |
| Worker | Execução em segundo plano no computador atual por meio de Providers explicitamente autorizados. |

Um computador pode habilitar as três funções. A opção “cinco computadores” representa o progresso
da integração inicial, não um limite de licença ou permissão; cada computador é registrado
separadamente e pode ser revogado separadamente.

O primeiro modo de integração de agentes externos do OpenBot é a delegação de escopo limitado. A
participação direta de agentes externos em canais virá depois, quando o comportamento de
identidade, memória, ciclo de vida e permissões tiver passado pelos mesmos testes de conformidade
do agente OpenBot nativo.

O modelo de plugins oferecerá suporte a UI/temas, canais, adaptadores de agentes,
ferramentas/Providers, automação e experiências opcionais. Os plugins podem decidir a aparência ou
o funcionamento de um recurso dentro das capacidades concedidas, mas não podem decidir qual
autoridade possuem.

## Status do projeto

Atualmente, o OpenBot oferece uma fatia vertical testada que vai de um canal local a um Node de
execução remoto e retorna. A tabela separa deliberadamente o código funcional das capacidades
planejadas.

| Área | Disponível agora | Próximo passo |
| --- | --- | --- |
| Plano de controle | Autenticação local do Owner, migrações PostgreSQL com verificação de desvios, Bots, canais, associação, mensagens, Runs, aprovações, artefatos, ciclo de vida da memória de funcionários, invalidação de perfil em vários dispositivos sem conteúdo e eventos de auditoria | Inicialização pelo Desktop, rotinas persistentes, recuperação/retenção de memória, ferramentas de recuperação automatizada e confiança multiusuário |
| Clientes | Web UI responsiva e centrada em canais, direcionamento a Bots nomeados, resultados atribuídos ao Bot, respostas, rich text/tabelas, inspetor de Runs, aprovações, gerenciamento de Nodes, SSE limitado com recuperação por snapshot, abas acessíveis de funcionários e gerenciamento nativo de foco em modais | Um Electron Desktop em sandbox compartilhando a UI React, configuração guiada de funções, acesso Web/PWA instalável, notificações e aprimoramento da localização |
| Identidade do Bot | Aparência combinável em cinco camadas, persistida com cada Bot e reutilizada nos canais e no perfil do funcionário | Mais partes e pacotes de aparência criados pela comunidade |
| Perfil do funcionário | Perfil com sete visualizações, edição de função e biografia pelo Owner com verificação de revisão, arquivo de evolução datado inspirado no Hermes com filtros e referências completas às evidências, revisão de habilidades pelo Owner que pode ser inspecionada, memória tipada gerenciada pelo Owner com auditoria sem conteúdo, exportação segura de modelos que preserva a biografia e vincula exatamente o download revisado, importação em quarentena, ativação revisada com identidade nova e assinatura DSSE experimental | Editores de políticas de nome de exibição/modelo/host/aparência, recuperação/retenção de memória e propostas autônomas, keyring/KMS nativos e adaptadores de confiança pública, pacotes executáveis de Agent Skills com revisão integral do diff, clonagem seletiva, distribuição por registro e transferência de propriedade |
| Protocolo de Node | Registro WebSocket de saída, UI do Owner para pareamento único/listagem/revogação, credenciais revogáveis individualmente, heartbeat, capacidade, roteamento exato pela versão principal da capacidade, atribuição em duas fases, início explícito, progresso, frames, conclusão, recuperação após desconexão e perfis experimentais de serviço Linux de sistema/usuário com Secret Service testado por contrato | Instalação guiada da função Worker, identidade com prova de posse, mTLS, rotação, proteção contra repetição, keyrings nativos, instaladores assinados e relatórios de conformidade em dispositivos reais |
| Execução no navegador | Abrir uma URL HTTP(S) pública e explícita por meio do limite fixado do CopilotKit/OpenBot `agent-computer` e retornar uma captura de tela PNG com tamanho limitado | Ciclo observe/fill/act, frames contínuos, interação segura com formulários e semântica de novas tentativas |
| Controle humano | Fluxo persistido de solicitação/decisão de aprovação vinculado a Run, Node, ação, impressão digital do destino, risco e expiração | Leases de capacidade assinadas e de uso único e tomada de controle remoto exclusiva |
| Providers | Adaptador Docker/navegador funcional e somente leitura; limites de pacotes tipados para Cua, Lume e coder | Navegador portátil, desktops Windows, macOS e Linux, Android gerenciado e Providers de programação isolados |
| Ambiente de execução do agente | Fundamentos de Bot, canal, Run, resultado, perfil, habilidade, memória e auditoria controlados pelo Server | Um agente OpenBot nativo, passagem multiagente durável e adaptadores de escopo limitado para Hermes, Pi e OpenClaw |
| Plugins | Pacote isolado `@openbot/office-plugin`, sem dependência do aplicativo principal | Manifestos com permissões, ciclo de vida, APIs do Host em sandbox, slots de UI, desenvolvimento local e futura distribuição confiável |
| Distribuição | Código-fonte e uma prévia de fundação anterior somente em código-fonte | Instaladores Desktop assinados no GitHub Releases, artefatos Worker, evidências de upgrade/rollback e pacotes SDK ou contêiner úteis separadamente |

### O que a versão atual não promete

- Hoje não há cliente OpenBot Desktop público, instalador guiado de múltiplas funções, Worker Host
  instalável ou artefato OpenBot no GitHub Packages. A versão antiga `v0.1.0-alpha.1` é uma
  prévia de fundação somente em código-fonte e não representa o repositório atual nem o produto
  Desktop pretendido.
- Ela não realiza envios de formulário sem supervisão nem ações arbitrárias na área de trabalho.
- Ainda não emite leases de capacidade criptográficos e de uso único depois da aprovação.
- Não oferece controle contínuo de área de trabalho remota.
- O registro de Nodes é revogável individualmente, mas a identidade atual ainda é um bearer secret
  copiável. Um login Linux dedicado pode armazená-lo explicitamente no Secret Service sem fallback
  para arquivo; as evidências em dispositivo real de keyring/systemd ainda estão pendentes. Isso
  não é identidade com prova de posse nem mTLS e deve permanecer protegido por WSS e uma rede
  privada confiável.
- Ela ainda não permite que modelos gravem ou recuperem memória de longo prazo de forma autônoma,
  apliquem cronogramas de retenção, clonem seletivamente a experiência dos funcionários,
  distribuam pacotes por um registro ou transfiram propriedade. O Owner autenticado pode adicionar,
  editar e excluir manualmente memórias limitadas; a memória continua excluída de todos os pacotes
  de funcionários v1.
- O Owner pode editar a função e a biografia descritiva de um funcionário. Esses campos são
  contexto de roteamento, não políticas de modelo, habilidades, vínculo ao host ou autoridade;
  edições concorrentes falham diante de uma revisão desatualizada.
- Por padrão, a exportação de funcionários permanece sem assinatura. Um operador pode habilitar a
  assinatura DSSE experimental com um keyring de sistema de arquivos criptografado,
  rotação/revogação offline e confiança explícita em chaves públicas; o download da exportação fica
  vinculado aos bytes exatos do pacote revisado, e a ativação da importação ainda exige o digest
  exato da prévia, revisão explícita do Owner, uma nova identidade local e habilidades somente como
  candidatas, sem memória ou autoridade sobre hosts.
- Os Providers Cua, Lume e coder são limites de extensão, não ambientes de execução concluídos.
- Hermes, Pi e OpenClaw são integrações planejadas, não adaptadores funcionais na compilação atual.
- Ainda não existe um ciclo de vida de instalação, permissão, sandbox, atualização ou rollback de
  plugins.
- A visualização opcional de escritório não faz parte da navegação atual do produto nem da
  compilação Web.

## Início rápido

Esta é uma configuração de desenvolvimento a partir do código-fonte para a fatia atual
Web/Server/Node. Não é o fluxo de instalação Desktop planejado.

### Requisitos

- Node.js 22.22.2+, 24.15.0+ ou 26+
- npm 10 ou mais recente
- Docker com Docker Compose

### Executar localmente

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
cp .env.example .env
```

Edite o arquivo `.env` e substitua o valor temporário da senha do Owner:

```dotenv
OPENBOT_OWNER_PASSWORD=<uma-senha-aleatoria-com-pelo-menos-15-caracteres>
```

O Server usa o IP do par conectado diretamente apenas como uma chave pseudonimizada para limitar
tentativas de login/registro. Com um único proxy reverso, defina
`OPENBOT_TRUSTED_PROXY_ADDRESS` como o IP exato desse proxy; somente assim um único valor
RFC 7239 `Forwarded: for=...` será aceito. Não o defina para um intervalo ou para uma cadeia
com vários saltos.

Instale as dependências, inicie o PostgreSQL e depois execute o Server e o aplicativo Web:

```bash
npm install
npm run db:up
npm run dev:server
# Em outro terminal:
npm run dev:web
```

Entre no aplicativo Web e abra **Nodes** na barra lateral para criar um token de pareamento de
curta duração e uso único. A CLI no host do Server oferece a mesma operação:

```bash
npm run node:enrollment-token -- local-development-node
```

Copie o `OPENBOT_NODE_ENROLLMENT_TOKEN` exibido para o `.env`, execute
`npm run dev:node` e remova o token do `.env` depois da primeira inicialização
bem-sucedida. O Node armazena sua nova credencial em `./data/node/identity.json` com
permissões exclusivas do Owner e a reutiliza nas inicializações posteriores. Abra
<http://localhost:5173>, entre com `OPENBOT_OWNER_PASSWORD`, crie um Bot e um canal e
adicione o Bot a esse canal. Consulte [Registro de Nodes](docs/NODE_ENROLLMENT.md) antes de parear
um host remoto.

Por padrão, o Node local declara corretamente que não possui capacidade de execução. As mensagens
continuam armazenadas como Runs enfileirados até que um Provider compatível seja configurado.
Interrompa o PostgreSQL com `npm run db:stop`. Leia
[Operações de banco de dados](docs/DATABASE.md) antes de atualizar, fazer backup ou restaurar uma
implantação. Para assinar modelos portáteis de funcionários, siga o
[guia de assinatura de funcionários](docs/EMPLOYEE_SIGNING.md) experimental; a assinatura fica
desabilitada por padrão.

### Habilitar a fatia de navegador somente leitura

Execute o
[`agent-computer` do CopilotKit/OpenBot](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer)
na versão fixada no computador do Node e mantenha-o vinculado ao loopback. Configure os dois
valores abaixo com o mesmo computer token e reinicie o Node:

```dotenv
OPENBOT_DOCKER_COMPUTER_URL=http://127.0.0.1:4100
OPENBOT_DOCKER_COMPUTER_TOKEN=<um-token-aleatorio-com-pelo-menos-16-caracteres>
OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false
```

Envie uma mensagem no canal contendo uma URL pública explícita, por exemplo:

```text
Abra https://example.com e envie uma captura de tela.
```

O Server atribui o Run a um Node compatível, transmite o progresso estruturado e o frame mais
recente, armazena a captura de tela final e publica o resultado com a identidade do Bot selecionado.

## Como tudo se conecta

```text
Desktop (planejado) --+
                      +--> OpenBot Server --> agente OpenBot / adaptadores limitados (planejados)
Web (disponível) -----+       fonte de verdade          |
                                                         v
                                        conexões Worker de saída --> Providers
                                        Windows / macOS / Linux
```

| Componente | Controla | Não controla |
| --- | --- | --- |
| Desktop / Web Client | Interação, observação, configuração e entrada de aprovação | Decisões de política ou autoridade de execução |
| Server | Identidade, canais, Runs, roteamento, políticas, aprovações, auditoria e persistência | Capacidades de computador específicas do host |
| Agente OpenBot / adaptador de agente | Planejamento, tarefas de escopo limitado, progresso estruturado e resultados | Concessões de permissão, autorização de dispositivos ou verdade de auditoria |
| Worker Host / Node | Descoberta de capacidades, capacidade local, execução de Providers, progresso e artefatos | Identidade, habilidades, memória de longo prazo ou política de autorização dos funcionários |
| Provider | Um backend de execução restrito, como Docker/navegador, Cua, Lume ou coder | Roteamento entre Nodes ou escalonamento de privilégios |
| Plugin | Apresentação ou comportamento dentro das capacidades declaradas e concedidas | Autoautorização ou desvio da política do Server |

O Server é a única fonte de verdade. Os Nodes se conectam para fora e nunca exigem uma porta
pública de gerenciamento. O roteamento é determinístico: o perfil de execução fixo de um Run é
intersectado com as capacidades dos Nodes online; o modelo não pode selecionar uma máquina não
autorizada.

Para conhecer o projeto detalhado, leia [Arquitetura](docs/ARCHITECTURE.md) e o
[registro de decisão Server/Node](docs/decisions/0002-local-channel-server-node.md).

## Base de desenvolvimento

O OpenBot reduz a quantidade de linguagens para que a maioria dos colaboradores precise apenas do
Node.js e do npm:

| Área | Base |
| --- | --- |
| Código de produto compartilhado | TypeScript para Web, Server, Node, protocolos, adaptadores de agentes, SDKs de plugins e testes |
| Interface do usuário | React e Vite compartilhados pela Web e pelo Electron Desktop planejado |
| Ambiente de execução JavaScript de produção | Node.js 24 LTS como linha preferencial de desenvolvimento e implantação; o código-fonte atual ainda segue o intervalo mais amplo de engines em `package.json` |
| Persistência | PostgreSQL e migrações SQL revisadas |
| Integração exclusiva do macOS | Uma camada Swift fina para Keychain, ciclo de vida de serviços, permissões e controle nativo |
| Integração exclusiva do Windows | Uma camada C#/.NET fina para ciclo de vida de Service, credenciais protegidas, supervisão de processos e controle nativo |
| Agentes externos | A linguagem upstream correspondente atrás de um adaptador OpenBot tipado; o Hermes permanecer em Python não transforma Python em uma linguagem principal do OpenBot |

O Electron é a direção aceita para o Desktop porque maximiza a reutilização do sistema
TypeScript/React atual. A versão exata ainda deve ser fixada pelo processo de pesquisa e ADR do
repositório antes da implementação. Rust não é uma linguagem principal, a menos que uma lacuna
futura de plataforma, sustentada por evidências, justifique sua inclusão.

## Segurança

O OpenBot pressupõe que modelos, prompts, páginas web, habilidades e ambientes de execução podem
não ser confiáveis. O limite de segurança pretendido é:

1. O Server autoriza; o Node executa.
2. Os Runs têm relações fixas com Bot, canal, Node e perfil de execução.
3. Ações de escrita, destrutivas e privilegiadas devem falhar de forma segura enquanto aguardam
   aprovação.
4. Artefatos e eventos em tempo real têm limites e são validados antes da publicação.
5. Os Nodes se conectam ao Server; serviços de gerenciamento, bancos de dados, sockets do Docker e
   backends de computador não devem ser expostos publicamente.

Para qualquer uso além do desenvolvimento em loopback, use HTTPS, defina
`OPENBOT_SECURE_COOKIES=true`, restrinja `OPENBOT_ALLOWED_ORIGINS` e coloque a
implantação atrás de uma rede privada, como o Tailscale. O Server agora rejeita, antes de iniciar,
origens HTTP remotas ou origens remotas sem cookies Secure. Sessões HTTPS usam um cookie
`__Host-openbot_session` exclusivo do host e HSTS; por padrão, o desenvolvimento direto
fica vinculado ao loopback.

Consulte [SECURITY.md](SECURITY.md) para relatar vulnerabilidades e o
[modelo de ameaças](docs/SECURITY.md) para conhecer as garantias atuais e lacunas conhecidas.

## Roteiro

O OpenBot é desenvolvido em marcos orientados por critérios de aceitação. As contribuições devem
avançar um destes resultados para o usuário, em vez de adicionar uma demonstração isolada.

| Marco | Resultado |
| --- | --- |
| Foundation — disponível agora | Canais locais, Bots, autenticação, persistência PostgreSQL, auditoria, perfis de funcionários, roteamento de Nodes, aprovações e um ciclo completo de navegador somente leitura. |
| R0 — Contrato de produto e tecnologia | Alinhar a documentação bilíngue, registrar o modelo Desktop/Web/funções e fixar decisões tecnológicas pesquisadas. |
| R1 — Desktop e Web compartilhados | Reutilizar a UI React em um Electron Desktop em sandbox, mantendo o cliente completo no navegador. |
| R2 — Funções guiadas e vários computadores | Criar ou ingressar em um espaço de trabalho, habilitar funções Client/Server/Worker, instalar serviços, parear cada computador, diagnosticar falhas e revogar dispositivos. |
| R3 — Auto-hospedagem modular | Operar os serviços Server, Web, PostgreSQL e Worker sem exigir o Desktop, com orientações de backup, recuperação e rede privada. |
| R4 — OpenBot nativo e agentes externos | Tornar o OpenBot um agente coordenador durável e depois adicionar adaptadores limitados para Hermes, Pi e OpenClaw atrás do mesmo limite de autoridade. |
| R5 — Plataforma de plugins | Adicionar plugins de UI, tema, canal, Agent, ferramenta/Provider, automação e experiências opcionais com permissões, ciclo de vida e rollback. |
| R6 — Controle seguro de computador | Adicionar observe/fill/act, leases de capacidade de uso único, frames contínuos, tomada de controle exclusiva e Providers nativos comprovados. |
| R7 — Distribuição | Entregar instaladores Desktop assinados pelo GitHub Releases, artefatos Worker verificados, SBOMs, upgrades, rollback, backup e recuperação. |

Os documentos específicos de produto, arquitetura e roteiro serão alinhados a essa sequência aceita
antes do início da implementação de R1. Os gates de capacidade existentes permanecem em
[docs/ROADMAP.md](docs/ROADMAP.md) até que essa tarefa de documentação seja revisada.

## Como contribuir

O OpenBot foi feito para ser desenvolvido abertamente. Você não precisa entender o sistema inteiro
antes de contribuir.

A maioria dos colaboradores precisa apenas da linha recomendada Node.js 24 LTS e do npm. Swift só
é necessário para trabalho nativo do macOS, e .NET só é necessário para trabalho nativo do Windows;
a CI hospedada fornece as etapas de verificação multiplataforma.

Bons pontos de partida:

| Interesse | Comece em |
| --- | --- |
| UX compartilhada do Desktop e da Web | `apps/web`, o futuro `apps/desktop`, [guia de interface](docs/INTERFACE.md) |
| APIs, persistência e tempo real | `apps/server`, `packages/db`, [referência da API](docs/API.md) |
| Protocolo de Node e confiabilidade | `apps/node`, `packages/protocol`, [arquitetura](docs/ARCHITECTURE.md) |
| Backends de computador | `providers/*`, `packages/provider-sdk` |
| Políticas e segurança | `packages/policy`, [modelo de ameaças](docs/SECURITY.md) |
| Documentação e tradução | `README*.md`, `docs/`, registros de decisão |
| Experiências opcionais | `packages/office-plugin` e plugins futuros, sem acoplá-los ao aplicativo principal |

Fluxo de contribuição:

1. Leia [CONTRIBUTING.md](CONTRIBUTING.md) e escolha uma jornada de aceitação de escopo limitado.
2. Use uma Issue existente ou abra uma Issue de bug/recurso com o modelo fornecido.
3. Mantenha as capacidades de execução atrás de limites tipados de Provider e de testes
   fail-closed.
4. Execute `npm run check` e `npm audit` antes de abrir um pull request.
5. Preencha o modelo de pull request, incluindo a verificação e o impacto na segurança.

Use um fork ou um branch de recurso específico e envie um pull request; trabalhos de
funcionalidade não vão diretamente para `main`. Um colaborador só precisa do conjunto de
ferramentas da plataforma referente ao código específico que alterar.

A documentação faz parte do recurso. O inglês é o idioma canônico do projeto; as traduções
mantidas devem preservar as mesmas declarações, advertências e estrutura de seções. Novas traduções
são bem-vindas.

## Mapa do repositório

```text
apps/
  web/                 UI responsiva de canais
  server/              plano de controle, API, persistência, roteamento, aprovações
  node/                daemon Node de execução com conexão de saída
packages/
  domain/              entidades compartilhadas
  protocol/            mensagens Server/Node versionadas e validação de API
  db/                  esquema PostgreSQL e migrações
  policy/              avaliador determinístico de políticas fail-closed
  provider-sdk/        contratos de Provider
  provider-conformance-runner/ evidências de cenários limitados de Provider
  office-plugin/       visualização opcional adiada
providers/
  docker/              adaptador de navegador atual e somente leitura
  cua/                 limite de extensão do macOS
  lume/                limite de extensão de VM do macOS
  coder/               limite de extensão de agente de programação
deploy/                 recursos do Compose, systemd e launchd
docs/                   produto, arquitetura, segurança, roteiro, API e ADRs
```

## Documentação

| Objetivo | Comece aqui |
| --- | --- |
| Entender o produto e seus limites | [Definição do produto](docs/PRODUCT.md) |
| Entender o sistema | [Arquitetura](docs/ARCHITECTURE.md) |
| Seguir a sequência atual de implementação | [Plano de execução do Goal mode](docs/EXECUTION_PLAN.md) |
| Revisar entregas atuais e futuras | [Roteiro](docs/ROADMAP.md) |
| Desenvolver ou integrar usando a API | [API local](docs/API.md) |
| Revisar as garantias de segurança | [Modelo de ameaças](docs/SECURITY.md) |
| Trabalhar na experiência dos canais | [Guia de interface](docs/INTERFACE.md) |
| Revisar ou melhorar o comportamento de teclado e tecnologias assistivas | [Base de acessibilidade](docs/ACCESSIBILITY.md) |
| Projetar a identidade e a portabilidade dos funcionários | [Modelo de funcionário portátil](docs/EMPLOYEE.md) |
| Operar pacotes de funcionários assinados | [Guia de assinatura de funcionários](docs/EMPLOYEE_SIGNING.md) |
| Adicionar um sistema operacional ou dispositivo | [Worker Hosts multiplataforma](docs/CROSS_PLATFORM.md) |
| Testar uma declaração sobre Worker Host ou Provider | [Conformidade de Provider](docs/PROVIDER_CONFORMANCE.md) |
| Entender as escolhas upstream | [Estratégia upstream](docs/UPSTREAMS.md) |
| Seguir o processo de revisão que prioriza código aberto | [Política de reutilização de código aberto e auditoria atual](docs/OPEN_SOURCE_REUSE.md) |
| Escolher uma contribuição que possa ser revisada de forma independente | [Pacotes de trabalho para colaboradores](docs/CONTRIBUTOR_TASKS.md) |
| Entender por que uma decisão foi tomada | [Registros de decisão de arquitetura](docs/decisions/) |

## Projetos upstream

O OpenBot integra ideias e interfaces restritas de trabalhos de código aberto existentes, em vez de
copiar vários planos de controle para um só repositório:

- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) — limite atual do Provider
  `agent-computer` e pesquisa de produto.
- [Cua](https://github.com/trycua/cua) e Lume — Providers de execução para macOS planejados.
- [OpenClaw](https://github.com/openclaw/openclaw) — candidato planejado a adaptador limitado, além
  de referência operacional e de habilidades; nunca uma segunda fonte de verdade.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — primeiro candidato a adaptador de
  agente externo e referência de produto devidamente atribuída para o arquivo de evolução dos
  funcionários, learning graph, separação entre habilidades e memória e gravações de habilidades
  revisadas.
- Pi — candidato planejado a adaptador de agente externo; o upstream e a versão exatos devem ser
  registrados em uma nota de pesquisa antes da implementação.
- [Agent Skills](https://github.com/agentskills/agentskills) — formato padrão e validador oficial
  planejados para pacotes de habilidades executáveis.
- Codex, Claude e Multica — integrações planejadas e isoladas de Providers de programação.

As licenças e os avisos upstream devem ser preservados sempre que código for incorporado.

## Licença e nome

O OpenBot está disponível sob a [Licença MIT](LICENSE).

`OpenBot` é atualmente um nome de trabalho para o projeto e já é usado por outros projetos
públicos, incluindo o CopilotKit/OpenBot. Um nome público distinto deverá ser escolhido antes de
uma versão estável. O projeto não é afiliado à xAI, Tencent, CopilotKit, OpenClaw nem aos demais
projetos mencionados.
