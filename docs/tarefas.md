# Tarefas técnicas — AgendaPsico

**Fontes:** `specs/01-requisitos.md`, `specs/02-regras-de-negocio.md`, `specs/03-criterios-de-aceite`, `AGENTES.md`.  
**Nota:** `docs/plano.md` não estava no repositório no momento desta lista. A ordem abaixo segue dependências técnicas da spec (domínio → persistência → autenticação → agenda pública → consultas → automações → prontuário → relatórios).

**Regras desta lista**

- Cada item é uma unidade pequena, com verificação objetiva (teste Vitest e/ou critério de aceite).
- Não implementar o que a spec não descreve.
- Dúvidas de negócio vão para `specs/duvidas.md`, não para código.
- Testes de aceite devem mapear `specs/03-criterios-de-aceite`.

**Lacunas da spec a respeitar (não inventar regra)**

- Entidade `Psicologo` não lista senha; o perfil exige e-mail e senha — persistir apenas hash de senha como requisito de autenticação (seção 3.1).
- Notas aditivas (RN14, Cenário 09) não têm entidade no modelo 2.x — persistir como estrutura mínima ligada à consulta, sem campos extra de produto.
- Campos de endereço base e link de sala (RN04) não estão no modelo 2.1 — persistir como configuração do psicólogo exigida pela RN04.

---

## Fase 0 — Fundação

### T001 — Inicializar projeto Node.js
**Fazer:** `package.json` com Node.js, scripts `dev` e `test`.  
**Verificar:** `npm test` e o script de start existem e executam sem erro em projeto vazio.

### T002 — Instalar Fastify
**Fazer:** app Fastify com rota de saúde `GET /health`.  
**Verificar:** teste HTTP retorna 200 e corpo indicando que o servidor está no ar.

### T003 — Configurar Vitest
**Fazer:** Vitest para testes unitários e de integração HTTP.  
**Verificar:** um teste trivial passa com `npm test`.

### T004 — Separar camadas SOLID (esqueleto)
**Fazer:** pastas/módulos para domínio, casos de uso, infraestrutura e HTTP, sem regras de negócio ainda.  
**Verificar:** um caso de uso de exemplo (ex.: health) é chamado pelo handler Fastify sem lógica no handler.

---

## Fase 1 — Domínio (tipos alinhados à spec)

### T005 — Tipos da entidade Psicologo
**Fazer:** tipo/entidade com `id` UUID, `nome`, `email`, `whatsapp`, `crp`, `dataHoraCriacao`.  
**Verificar:** teste de fábrica/validação de shape rejeita objeto sem esses campos.

### T006 — Tipos da entidade Paciente
**Fazer:** tipo com `id`, `nome`, `email`, `whatsapp`, `cpf` único de negócio, `dataHoraCriacao`.  
**Verificar:** teste garante `cpf` presente e tratado como chave de unificação.

### T007 — Tipos da entidade Consulta
**Fazer:** tipo com FKs, `dataHoraInicio`/`dataHoraFim` (horário agendado), `modalidade` (`PRESENCIAL` | `ONLINE`), `localOuLink`, `status` (cinco valores da spec), `tokenAcesso`, `anotacaoProntuario`, auditoria.  
**Verificar:** teste rejeita status ou modalidade fora do enum da spec.

### T008 — Tipos da entidade GradeHoraria
**Fazer:** tipo com `psicologoId`, `diaSemana` 0–6, `horarioInicio`, `horarioFim`, `duracaoSessaoMinutos`, `intervaloMinutos`.  
**Verificar:** teste rejeita `diaSemana` fora de 0–6.

### T009 — Tipos da entidade BloqueioAgenda
**Fazer:** tipo com `psicologoId`, `dataHoraInicio`, `dataHoraFim`, `motivo`.  
**Verificar:** teste rejeita intervalo com fim anterior ou igual ao início.

---

## Fase 2 — Persistência

### T010 — Esquema/tabela Psicologo
**Fazer:** persistência com e-mail único e PK UUID.  
**Verificar:** inserir dois registros com o mesmo e-mail falha (constraint ou equivalente).

### T011 — Credencial do psicólogo (hash de senha)
**Fazer:** armazenar hash de senha associado ao psicólogo (autenticação 3.1), sem persistir senha em texto.  
**Verificar:** teste de persistência não contém a senha em claro; hash é verificável.

### T012 — Esquema/tabela Paciente
**Fazer:** persistência com `cpf` único.  
**Verificar:** segundo paciente com o mesmo CPF falha.

### T013 — Esquema/tabela Consulta
**Fazer:** persistência com FKs para psicólogo e paciente e enum de status/modalidade.  
**Verificar:** consulta sem `psicologoId` ou `pacienteId` válidos não persiste.

### T014 — Esquema/tabela GradeHoraria
**Fazer:** persistência ligada a `psicologoId`.  
**Verificar:** grade órfã (psicólogo inexistente) não persiste.

### T015 — Esquema/tabela BloqueioAgenda
**Fazer:** persistência ligada a `psicologoId` com intervalo de timestamps.  
**Verificar:** bloqueio órfão não persiste.

### T016 — Isolamento por psicólogo na consulta de dados
**Fazer:** repositórios/listagens de agenda, grade, bloqueio e prontuário filtrados por `psicologoId` autenticado.  
**Verificar:** teste com dois psicólogos: A não lê consultas/grade/bloqueios de B.

---

## Fase 3 — Cadastro e autenticação do psicólogo

### T017 — Cadastro RN01: campos obrigatórios
**Fazer:** endpoint/caso de uso de cadastro exigindo nome, e-mail, CRP e WhatsApp.  
**Verificar:** cada campo ausente retorna erro de validação; conjunto completo persiste.

### T018 — Cadastro RN01: e-mail único
**Fazer:** recusar cadastro com e-mail já existente.  
**Verificar:** segundo cadastro com o mesmo e-mail falha de forma determinística.

### T019 — Login e-mail e senha
**Fazer:** autenticação do perfil ADMINISTRADOR (psicólogo) com e-mail e senha.  
**Verificar:** credencial válida emite sessão/token; inválida é rejeitada.

### T020 — Rotas do painel exigem psicólogo autenticado
**Fazer:** middleware/guard em rotas de painel, grade, bloqueio, prontuário e relatórios.  
**Verificar:** request sem autenticação recebe 401.

---

## Fase 4 — Grade e modalidade (RN02, RN04)

### T021 — Salvar grade: dias e expediente
**Fazer:** psicólogo autenticado cria/atualiza `GradeHoraria` com dia da semana e início/fim.  
**Verificar:** GET da grade do psicólogo devolve o registro salvo.

### T022 — Salvar grade: duração e intervalo técnico
**Fazer:** persistir `duracaoSessaoMinutos` e `intervaloMinutos` na grade.  
**Verificar:** valores salvos são os enviados; ausência de um deles falha validação.

### T023 — Configuração presencial: endereço base obrigatório
**Fazer:** psicólogo configura endereço base quando oferece `PRESENCIAL` (RN04).  
**Verificar:** ativar presencial sem endereço é rejeitado.

### T024 — Configuração online: link de sala obrigatório
**Fazer:** psicólogo configura link fixo da sala quando oferece `ONLINE` (RN04).  
**Verificar:** ativar online sem link é rejeitado.

---

## Fase 5 — Bloqueios (RN03)

### T025 — Criar bloqueio pontual
**Fazer:** psicólogo cria `BloqueioAgenda` com início, fim e motivo.  
**Verificar:** bloqueio aparece na listagem do psicólogo dono.

### T026 — Alerta se bloqueio cobre consultas existentes
**Fazer:** ao criar bloqueio que intersecta consultas não canceladas, alertar o profissional para remarcar ou cancelar (RN03). **Não** cancelar automaticamente.  
**Verificar:** teste com consulta no intervalo: resposta contém alerta; consulta permanece no status original.

---

## Fase 6 — Geração de slots públicos

### T027 — Gerar slots a partir da grade
**Fazer:** calcular horários livres: de `horarioInicio` até `horarioFim`, fatias de `duracaoSessaoMinutos` + `intervaloMinutos`.  
**Verificar:** grade 08:00–10:00, 50 min + 10 min gera slots 08:00 e 09:00 (fim 08:50 e 09:50) e não gera slot que ultrapasse 10:00.

### T028 — Slot carrega modalidade e `localOuLink` do profissional
**Fazer:** cada slot público inclui modalidade oferecida e endereço ou link correspondente (paciente não escolhe o local — RN04).  
**Verificar:** payload do slot contém modalidade e `localOuLink` iguais à configuração do psicólogo.

### T029 — Listar slots públicos: excluir bloqueios (Cenário 04)
**Fazer:** `GET` (ou equivalente) da grade pública para uma data; omitir qualquer slot que intersecte `BloqueioAgenda`.  
**Verificar:** bloqueio 08:00–12:00 de amanhã → payload de amanhã **não** contém slots nesse intervalo, mesmo com grade padrão cobrindo o período.

### T030 — Listar slots públicos: excluir já ocupados
**Fazer:** omitir slots com consulta `AGENDADO`, `CONFIRMADO`, `REALIZADO` ou `FALTA_SEM_AVISO` no mesmo intervalo. Consulta `CANCELADO` libera o slot.  
**Verificar:** um horário com consulta agendada não aparece; após cancelamento (tarefa T041) o mesmo horário volta a aparecer.

### T031 — Janela máxima na listagem pública (RN06)
**Fazer:** não oferecer slots com início **> 60 dias corridos** a partir de agora.  
**Verificar:** slot no dia 61 não entra no payload; slot no limite de 60 dias corridos entra (alinhar ao Cenário 01).

### T032 — Janela mínima na listagem pública (RN05)
**Fazer:** não oferecer slots com início **< 2 horas** a partir de agora.  
**Verificar:** slot daqui a 1h59 não entra na listagem.

---

## Fase 7 — Agendamento público (RN05–RN08, Cenários 01–03)

### T033 — Formulário público: dados obrigatórios
**Fazer:** agendamento exige nome, e-mail, CPF e WhatsApp; não cria senha (RN08).  
**Verificar:** submit sem CPF (ou sem outro obrigatório) é rejeitado; sucesso não persiste senha de paciente.

### T034 — Unificar paciente por CPF
**Fazer:** se CPF já existe, reutilizar `Paciente`; senão criar.  
**Verificar:** dois agendamentos do mesmo CPF geram um único paciente e duas consultas.

### T035 — Recusar mesmo CPF no mesmo horário
**Fazer:** CPF não duplicado para o mesmo horário (Cenário 01).  
**Verificar:** segundo agendamento do mesmo CPF no mesmo `dataHoraInicio` é rejeitado.

### T036 — Persistir consulta AGENDADO com início/fim e token
**Fazer:** gravar consulta com status `AGENDADO`, `dataHoraInicio` do slot, `dataHoraFim` = início + duração da grade, `tokenAcesso` único (hash), modalidade e `localOuLink`.  
**Verificar:** registro persistido bate com o slot; `tokenAcesso` não é vazio e não colide.

### T037 — Aceitar exatamente 2 horas à frente (Cenário 01 / RN05)
**Fazer:** permitir agendar quando `dataHoraInicio - agora >= 2 horas`.  
**Verificar:** teste com relógio fixo: slot exatamente +2h é aceito e status é `AGENDADO`.

### T038 — Aceitar até 60 dias corridos (Cenário 01 / RN06)
**Fazer:** permitir agendar quando o início está em `<= 60 dias corridos`.  
**Verificar:** teste no limite de 60 dias corridos aceita; além disso rejeita.

### T039 — Rejeitar 1h59 no submit (Cenário 02)
**Fazer:** validar a janela mínima **no momento do submit**, não só na listagem.  
**Verificar:** slot que na listagem era válido, com relógio avançado para 1h59 restantes, API rejeita com mensagem do limite mínimo de 2 horas.

### T040 — Overbooking com transação (Cenário 03 / RN07)
**Fazer:** travar o horário em transação isolada no commit do agendamento.  
**Verificar:** dois POSTs simultâneos no mesmo slot: um 200 com consulta criada; o outro 409 com mensagem de horário não mais disponível; apenas uma consulta persistida.

### T041 — E-mail “Consulta Registrada” com magic link (RN08, Cenário 01)
**Fazer:** após sucesso, disparar e-mail com token/link de acesso (título/assunto alinhado ao aceite: “Consulta Registrada”).  
**Verificar:** porta de e-mail fake recebe uma mensagem contendo o link/token; consulta pública/API de paciente não inclui prontuário.

---

## Fase 8 — Magic link do paciente

### T042 — Resolver consulta por `tokenAcesso`
**Fazer:** acesso do paciente só com token; sem senha.  
**Verificar:** token válido retorna a própria consulta; token inválido falha; token de outra consulta não vaza dados.

### T043 — API pública do paciente não expõe prontuário (RN12)
**Fazer:** payload do magic link (e qualquer rota pública) sem `anotacaoProntuario` e sem notas aditivas.  
**Verificar:** teste de contrato: campo clínico ausente mesmo com nota gravada.

---

## Fase 9 — Cancelamento e remarcação

### T044 — Paciente cancela com >= 24h (RN09, Cenário 05)
**Fazer:** via magic link, com 48h de antecedência: status `CANCELADO` e slot volta à grade pública.  
**Verificar:** status persistido `CANCELADO`; o mesmo horário reaparece no payload público.

### T045 — Paciente cancela exatamente em 24h (RN09)
**Fazer:** botão/ação de cancelar no lembrete de exatas 24h é válido.  
**Verificar:** com relógio em exatamente 24h antes, cancelamento autônomo sucede e libera vaga.

### T046 — Paciente tenta cancelar com < 24h (RN10, Cenário 06)
**Fazer:** bloquear cancelamento sistêmico; orientar contato via WhatsApp do psicólogo; **não** liberar vaga.  
**Verificar:** com 23h restantes: ação interceptada/desabilitada; status inalterado; slot continua ocupado; resposta aponta WhatsApp do profissional.

### T047 — Psicólogo cancela a qualquer momento (RN11)
**Fazer:** psicólogo autenticado cancela; status `CANCELADO`; vaga imediata na grade pública; (notificação ao paciente se o canal de cancelamento do psicólogo for o mesmo fluxo de RN11 — disparar notificação de cancelamento).  
**Verificar:** consulta some da disponibilidade ocupada e reaparece no público; paciente não autenticado não consegue esta rota.

### T048 — Psicólogo remarca a qualquer momento (RN11)
**Fazer:** alterar `dataHoraInicio`/`dataHoraFim` para outro slot livre da grade, respeitando bloqueios.  
**Verificar:** horário antigo livre na grade pública; novo horário ocupado; consulta não fica `CANCELADO` só por remarcar.

---

## Fase 10 — Jobs e notificações (RN16–RN17, Cenários 07–08)

### T049 — Job de lembrete 24h (Cenário 07 / RN16)
**Fazer:** worker/cron seleciona consultas `AGENDADO` cujo início está exatamente 24h à frente e envia e-mail e WhatsApp com ações Confirmar e Cancelar.  
**Verificar:** com relógio fixo, uma consulta +24h recebe os dois disparos; consulta +23h ou +25h não recebe neste ciclo.

### T050 — Confirmar presença pelo link do lembrete (Cenário 07)
**Fazer:** ação autenticada por token altera status `AGENDADO` → `CONFIRMADO`.  
**Verificar:** após o clique, persistência mostra `CONFIRMADO`.

### T051 — Cancelar pelo lembrete só se RN09 permitir
**Fazer:** o botão Cancelar do lembrete reutiliza T044/T045/T046 (não criar terceira regra).  
**Verificar:** em +24h cancela; em +23h cai no fluxo WhatsApp.

### T052 — Alerta “Confirmação Pendente” no painel (RN17, Cenário 08)
**Fazer:** no dashboard do psicólogo, consultas `AGENDADO` com `<= 12 horas` para o início recebem a tag.  
**Verificar:** consulta com 11h59 restantes e status `AGENDADO` vem destacada; `CONFIRMADO` no mesmo prazo não recebe a tag.

### T053 — Job/sistema só nas permissões da spec 3.3
**Fazer:** workers limitados a lembretes, alerta visual e transições de status passivas — sem escrever prontuário.  
**Verificar:** teste de autorização/caso de uso do worker não consegue gravar `anotacaoProntuario`.

---

## Fase 11 — Status passivos da sessão

### T054 — Transição passiva para REALIZADO / FALTA_SEM_AVISO
**Fazer:** implementar apenas o que a spec 3.3 chama de “transições de status passivas”, documentando em teste o gatilho usado. Se o gatilho exato não estiver na spec, registrar dúvida em `specs/duvidas.md` e **não** inventar produto na UI.  
**Verificar:** há teste cobrindo a transição que for efetivamente especificada; qualquer incerteza está em `specs/duvidas.md`.

---

## Fase 12 — Prontuário (RN12–RN14, Cenários 09–10)

### T055 — Criptografar `anotacaoProntuario` com AES-256 reversível (RN13, Cenário 10)
**Fazer:** ao salvar, persistir ciphertext (ex. Base64), não texto plano.  
**Verificar:** leitura direta da coluna/tabela mostra string ilegível; psicólogo autenticado lê o texto original após decrypt.

### T056 — Somente psicólogo autenticado lê/grava nota (RN12)
**Fazer:** rotas de prontuário exigem sessão do dono da consulta (`psicologoId`).  
**Verificar:** outro psicólogo recebe 403/404; rota pública 401/404 e sem ciphertext no JSON.

### T057 — Editar nota principal até 48h após `dataHoraFim` (RN14)
**Fazer:** PUT da nota principal permitido se `agora <= dataHoraFim + 48h`.  
**Verificar:** em +47h59 a edição persiste; em +48h01 a edição da nota principal é rejeitada.

### T058 — Nota principal somente leitura após 48h (Cenário 09)
**Fazer:** após 49h com status `REALIZADO`, campo principal read-only.  
**Verificar:** tentativa de alterar a nota principal falha; GET indica somente leitura.

### T059 — Nota aditiva após a janela de 48h (RN14, Cenário 09)
**Fazer:** inserir texto anexo com carimbo de data/hora da adição; não apagar a nota principal.  
**Verificar:** após 49h, “Adicionar Nota Aditiva” persiste novo trecho com timestamp; `anotacaoProntuario` original permanece.

### T060 — Notas não são excluídas
**Fazer:** não oferecer exclusão de nota principal nem aditiva.  
**Verificar:** DELETE (ou equivalente) em prontuário é rejeitado; registros permanecem.

---

## Fase 13 — Relatório de absenteísmo (RN15)

### T061 — Taxa de absenteísmo por CPF
**Fazer:** `(quantidade FALTA_SEM_AVISO / total de consultas não canceladas) * 100`, agrupado por CPF do paciente.  
**Verificar:** paciente com 1 falta e 3 consultas não canceladas → 33,333…% (ou representação numérica estável documentada no teste); consultas `CANCELADO` fora do denominador.

### T062 — Relatório só no painel autenticado
**Fazer:** taxa visível ao psicólogo dono das consultas.  
**Verificar:** sem login 401; psicólogo A não vê taxas calculadas só com dados de B.

---

## Ordem sugerida de execução

T001 → T004 → T005–T009 → T010–T016 → T017–T020 → T021–T024 → T025–T026 → T027–T032 → T033–T041 → T042–T043 → T044–T048 → T049–T053 → T054 → T055–T060 → T061–T062.

**Critérios de aceite (mapeamento)**

| Cenário | Tarefas |
| --- | --- |
| 01 | T033–T038, T041 |
| 02 | T039 |
| 03 | T040 |
| 04 | T029 |
| 05 | T044, T030 |
| 06 | T046 |
| 07 | T049, T050 |
| 08 | T052 |
| 09 | T058, T059 |
| 10 | T055 |
