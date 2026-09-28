analise

# Análise da especificação — AgendaPsico

**Fonte lida:** `specs/01 requisitos.md`, `specs/02 regras-de-negocio.md`, `specs/03 criterios-de-aceite.md` e `AGENTES.md` (arquivo existente: `AGENTES.md`).

**Escopo desta análise:** ambiguidades, conflitos, regras ausentes, casos de borda e critérios de aceite faltando.  
**Não foram tomadas decisões de negócio.** Itens abaixo são perguntas para o dono do produto/regra.

---

## 0. Observações de documentação (não são regras de produto)

- O arquivo de agentes chama-se `AGENTES.md`, não `AGENTS.md`.
- `AGENTES.md` cita `specs/03-criterios-aceita.md`; o arquivo real é `specs/03 criterios-de-aceite.md`.
- `AGENTES.md` pede registrar dúvidas de negócio em `specs/duvidas.md`; este arquivo ainda não existe. Esta análise foi gravada em `docs/analise-spec.md`, conforme solicitado.

---

## 1. Ambiguidades

### 1.1 Entidade Consulta vs. outras entidades

- Só a entidade **Consulta** está descrita. Não há modelo explícito de Profissional, Paciente, Grade, Bloqueio, Lembrete, Nota aditiva, Sessão de autenticação ou Link público.
- `pacienteNome`, `pacienteEmail`, `pacienteWhatsapp` estão na Consulta. **Pergunta:** o paciente é uma entidade persistente (histórico/absenteísmo por pessoa) ou apenas dados copiados em cada agendamento?
- Se o paciente não cria senha no 1º acesso (RN08), **como** ele cancela/remarca depois? Token no e-mail? WhatsApp? Cadastro posterior?

### 1.2 Campos de data/hora da Consulta

- `dataHoraInicio` e `dataHoraFim` estão marcados como “carimbo do sistema”.
- **Pergunta:** esses campos são o horário **agendado** da sessão ou o momento em que o sistema registrou início/fim reais da sessão?
- Se forem carimbo de execução, **onde** fica o horário escolhido pelo paciente na grade?
- Se forem o horário da sessão, o termo “carimbo do sistema” é enganoso: o paciente (ou a grade) escolhe o início; o fim pode ser derivado do intervalo.

### 1.3 Grade horária (RN02)

- “Dias úteis”: **calendário brasileiro** (seg–sex, excluindo feriados nacionais) ou apenas dias que o profissional marcar?
- “Intervalo padrão”: é **duração da consulta**, **pausa entre consultas**, ou ambos?
- Grade é **única** para presencial e online, ou há grades por modalidade?
- Fuso horário: qual? Do profissional? Do paciente? UTC no banco?
- Recorrência da grade: semanal infinita? Com data de vigência?

### 1.4 Bloqueios (RN03)

- Bloqueio é **dia inteiro**, **intervalo de horas**, ou os dois?
- Bloqueio pode ser recorrente (todo feriado X) ou só pontual?
- Bloqueio em cima de consultas já agendadas: o sistema impede o bloqueio, cancela as consultas, ou o profissional deve cancelar antes?

### 1.5 Modalidade e `localOuLink` (RN04)

- O profissional configura **um** endereço e **um** link globais, ou por consulta?
- Paciente **escolhe** presencial vs. online, ou o profissional define por horário?
- Pode haver só uma modalidade cadastrada? O que acontece se o link/endereço não estiver preenchido no momento do agendamento?

### 1.6 Status da Consulta

- Não há máquina de estados. Transições permitidas não estão definidas (ex.: `AGENDADO → CONFIRMADO → REALIZADO`).
- **Quem** marca `REALIZADO` e `FALTA_SEM_AVISO`? Psicólogo? Sistema automático após `dataHoraFim`?
- Lembrete com botão “Cancelar” (Cenário 08) vs. regra de 24h (RN09/RN10): o clique em “Cancelar” no lembrete (tipicamente 24h antes) é cancelamento autônomo, pede WhatsApp, ou é um terceiro fluxo?
- `CONFIRMADO` é obrigatório para a sessão ocorrer, ou a consulta pode ocorrer em `AGENDADO`?

### 1.7 “Agendamento público” e autenticação

- “Link público” aparece no Cenário 04, mas não nos requisitos de funcionalidades com URL, expiração ou se o link é do profissional ou da clínica.
- Perfis: ADMINISTRADOR = psicólogo. **Pergunta:** um psicólogo = um tenant? Pode haver secretária? Múltiplos profissionais na mesma conta?
- PACIENTE: perfil de acesso sem senha no 1º acesso. Há login depois? O que o paciente vê além de agendar/cancelar/remarcar?
- SISTEMA: quais jobs existem além do lembrete de 24h e do alerta de 12h?

### 1.8 CRP “válido” (RN01)

- O que é CRP válido? Formato (UF + número)? Consulta a API do conselho? Apenas não vazio?
- E-mail e WhatsApp: formato, DDI obrigatório, unicidade (um CRP/e-mail/WhatsApp por conta)?

### 1.9 Remarcação

- Remarcar é **alterar** a mesma consulta ou **cancelar + criar nova**?
- A nova data precisa respeitar as mesmas janelas (2h–60 dias, 24h para o paciente)?
- Remarcação pelo psicólogo “a qualquer momento” inclui remarcar para o passado?

### 1.10 Prontuário (RN12–RN14)

- A nota fica **dentro** de `anotacaoProntuario` na Consulta ou em entidade Nota com histórico?
- “Complementadas por notas aditivas”: estrutura, prazo para aditar, se aditivo também tem janela de 48h.
- “Não podem ser expostas externamente”: inclui backups, e-mails, logs, painel do paciente, suporte ADMIN?
- AES-256: modo (GCM/CBC), gestão de chave, rotação, se a chave é por profissional ou global — a spec de produto não detalha; a spec de aceite só diz “salvo de forma criptografada”.
- Edição em 48h: 48h a partir de **quando**? Do primeiro save? Do status REALIZADO? Do `dataHoraFim` da sessão?
- Pode registrar nota **antes** do status REALIZADO?

### 1.11 Lembretes e canais (RN15)

- Conteúdo da mensagem, idioma, se inclui link/local, se o botão é URL assinada ou resposta WhatsApp.
- Falha de envio (WhatsApp indisponível, e-mail bounce): retry? alerta ao psicólogo?
- Envio **24h antes**: janela exata (cron a cada X minutos) ou exatamente 24:00:00 antes?
- Consulta criada com menos de 24h de antecedência (ainda dentro das 2h mínimas): **envia lembrete**? Alerta de 12h aplica?

### 1.12 Confirmação pendente (RN16)

- O alerta some se o paciente confirmar depois das 12h? E se confirmar depois do horário da sessão?
- Alerta é por consulta, badge no painel, e-mail ao psicólogo, ou os três?
- “12 horas antes” é o momento em que o alerta **passa a aparecer**, ou um job único na marca de 12h?

### 1.13 Histórico clínico e absenteísmo

- A funcionalidade está nos requisitos, **sem RN** e **sem critério de aceite**.
- **Pergunta:** fórmula da taxa de absenteísmo? (`FALTA_SEM_AVISO` / total? inclui cancelamentos tardios?)
- Janela temporal (últimos 12 meses? todas as consultas?)?
- Histórico clínico = lista de notas do mesmo paciente? Como identificar o “mesmo” paciente (e-mail? WhatsApp? nome?)?

### 1.14 Validações “válidos” no Cenário 01

- O que é e-mail válido e WhatsApp válido não está especificado (regex, verificação por código, aceite de número internacional).

### 1.15 Autorização e isolamento

- Psicólogo A pode ver agenda/prontuário do psicólogo B?
- Paciente vê só as próprias consultas? Como o sistema associa consultas ao paciente sem conta?

---

## 2. Conflitos (entre requisitos, RNs e critérios)

### 2.1 Cancelar no lembrete vs. antecedência de 24h

- RN15 / Cenário 08: botão **Cancelar** no lembrete enviado **24h antes**.
- RN09: cancelamento autônomo só com **mínimo 24h** de antecedência.
- RN10 / Cenário 06: menos de 24h → não cancela no sistema, manda WhatsApp.
- **Pergunta:** na marca exata de 24h, o botão Cancelar do lembrete é permitido? Se o cron atrasar 1 minuto, cai na RN10?

### 2.2 E-mail no agendamento vs. RN15

- Cenário 01: ao agendar, envia **e-mail de confirmação** ao paciente.
- Isso **não** está nas funcionalidades nem nas RNs (só lembrete 24h e notificações de cancelamento pelo psicólogo).
- **Conflito de cobertura:** o aceite exige um envio que a regra de negócio não lista. Incluir RN ou remover do aceite?

### 2.3 Confirmação de agendamento vs. status Agendado

- Cenário 01: status **Agendado** + e-mail de “confirmação”.
- Status **Confirmado** só aparece após o lembrete (Cenário 08).
- O e-mail inicial chama “confirmação” mas **não** muda para CONFIRMADO. Risco de produto/UX e de implementação.

### 2.4 `dataHoraInicio`/`Fim` como carimbo vs. agendamento futuro

- Requisitos: início/fim são carimbo do sistema.
- RN05/RN06 e vários cenários tratam horário **futuro da sessão**.
- Essas duas leituras não coexistem sem um campo adicional de horário da sessão.

### 2.5 Funcionalidade “cancelar ou remarcar” vs. Cenário 05

- Cenário 05: cancelamento **ou** remarcação → status **Cancelado** e vaga liberada.
- Para remarcação, status Cancelado na mesma consulta **sem** criar/atualizar novo horário deixa a remarcação indefinida (ou implica sempre cancelar e agendar de novo, o que não está dito).

### 2.6 RN14 vs. Cenário 10

- RN14: notas **não excluídas**; edição em 48h **ou** notas aditivas.
- Cenário 10: cobre criptografia, edição 48h e vedação de exclusão.
- **Não cobre** notas aditivas (fluxo após 48h). RN e aceite estão desalinhados em cobertura, não necessariamente em sentido contrário.

### 2.7 Overbooking “tempo real” (RN07) vs. Cenário 03

- RN07: validar disponibilidade em tempo real.
- Cenário 03: dois pacientes simultâneos; vence quem **concluir a confirmação dos dados** primeiro.
- **Pergunta:** existe reserva temporária enquanto o paciente preenche o formulário, ou o horário só trava no submit? “Tempo real” na UI pode mostrar disponível e o submit falhar — isso é aceitável?

### 2.8 Perfil PACIENTE vs. agendamento sem senha

- Há perfil PACIENTE, mas RN08 diz que não precisa criar senha no 1º acesso.
- Não está dito se existe 2º acesso com senha, magic link, ou se o perfil é só conceitual.

### 2.9 ADMINISTRADOR (Psicólogo)

- Nome do perfil sugere admin de plataforma; a descrição diz que é o psicólogo.
- **Pergunta:** existe superadmin da plataforma (SaaS) além do psicólogo, ou não?

---

## 3. Regras ausentes

Itens que a spec menciona como funcionalidade ou implica, mas **não** regula:

1. Autenticação e sessão do psicólogo (cadastro é RN01; login, recuperação de senha, logout, 2FA: ausentes).
2. Autenticação/identificação do paciente após o 1º agendamento.
3. Modelo e persistência de **Paciente**, **Grade**, **Bloqueio**, **Nota aditiva**, **Notificação**.
4. Duração da consulta e cálculo de `dataHoraFim`.
5. Capacidade: 1 paciente por slot? Grupo/terapia de casal?
6. Feriados: o sistema bloqueia automaticamente ou só via bloqueio manual (RN03)?
7. Transições de status e responsável por REALIZADO / FALTA_SEM_AVISO.
8. Comportamento quando a sessão chega ao horário ainda em AGENDADO (não confirmado).
9. No-show: prazo para marcar falta; se falta conta para absenteísmo; se a vaga do horário já passou “libera” para alguém (não faria sentido).
10. Remarcação: regras de novo horário, status, notificações, se conta como cancelamento na taxa.
11. Cancelamento pelo psicólogo: a vaga é **liberada** na grade? (Cenário 05 só diz isso para o paciente.)
12. Consultas já existentes no período quando se cria bloqueio.
13. Alteração da grade (reduzir horário) com consultas futuras fora da nova grade.
14. Edição de dados do paciente (nome/e-mail/WhatsApp) e impacto em consultas antigas.
15. Unicidade: mesmo e-mail/WhatsApp agendando dois horários no mesmo dia / com o mesmo profissional.
16. Limite de consultas futuras por paciente.
17. Política de dados / LGPD: consentimento, retenção, exclusão de conta, direito do titular vs. imutabilidade do prontuário.
18. Quem paga / financeiro / valor da consulta: não mencionado; confirmar se está **fora de escopo**.
19. Integração WhatsApp: provedor, opt-in, templates, falhas.
20. Integração e-mail: remetente, templates, falhas.
21. Criptografia: requisitos operacionais (chave, ambiente) além do algoritmo.
22. Auditoria (quem editou a nota, IP, horário).
23. Link público: geração, revogação, customização, se lista todos os horários livres.
24. Fuso, horário de verão, “dias corridos” vs. horário local no limite de 60 dias e nas 2h/24h/12h/48h.
25. Precisão das janelas: `>= 2 horas` ou `> 2 horas`? Inclusive no limite de 60 dias (dia 60 23:59 ou 60×24h)?
26. Validação de CRP, e-mail duplicado, WhatsApp duplicado no cadastro do profissional.
27. Múltiplos psicólogos, clínicas, ou apenas 1 profissional por instalação.
28. Idioma/locale da UI e das mensagens.
29. Acessibilidade e requisitos não funcionais (performance, disponibilidade) — ausentes por completo.
30. Histórico clínico e taxa de absenteísmo (fórmula, tela, permissões).
31. Edição da nota: versionamento visível? substitui o texto criptografado?
32. Permissão SISTEMA: o cron pode alterar status? Escrever prontuário? Não.

---

## 4. Casos de borda (precisam de resposta explícita)

### Agendamento

- Horário exatamente **2 horas** à frente: aceita ou recusa? (Cenário 02 usa 1h; não testa o limite.)
- Horário exatamente **60 dias** à frente, inclusive horário do dia.
- Paciente agenda no último slot do expediente que atravessa meia-noite.
- Grade com intervalo que não cabe no expediente (ex.: início 17:00, término 17:30, duração 50 min).
- Dois slots adjacentes: o fim de um coincide com o início do outro — conflito ou permitido?
- Agendar em feriado nacional sem bloqueio cadastrado.
- Modalidade online sem link (ou presencial sem endereço) no momento do clique.
- Mesmo paciente (mesmo e-mail) tenta dois horários simultâneos.
- Nome/e-mail/WhatsApp com espaços, maiúsculas, DDI, número já usado com outro nome.
- Link público acessado quando o profissional ainda **não** configurou a grade (RN02 é obrigatório?).
- Psicólogo sem cadastro completo tenta divulgar agenda.

### Concorrência

- Dois submits no mesmo milissegundo (Cenário 03 não define desempate além de “primeiro que concluir”).
- Paciente A começa o form, paciente B confirma, A confirma depois.
- Psicólogo bloqueia o horário enquanto o paciente está no formulário.

### Cancelamento / remarcação

- Exatamente **24 horas** antes: autônomo ou WhatsApp?
- Paciente clica Cancelar **no lembrete** enviado aos 24h.
- Paciente tenta remarcar para um horário que viola 2h ou 60 dias.
- Psicólogo cancela consulta já `REALIZADO` ou `FALTA_SEM_AVISO`.
- Psicólogo remarca consulta `CONFIRMADO`.
- Cancelamento duplo (paciente e psicólogo ao mesmo tempo).
- Consulta `CANCELADO`: pode ser reativada?

### Status e sessão

- Chega `dataHoraFim` e status ainda `AGENDADO` ou `CONFIRMADO`: vira REALIZADO, FALTA, ou fica parado até ação humana?
- Paciente confirma **depois** do horário da sessão.
- Paciente confirma, depois o psicólogo cancela.
- Status `FALTA_SEM_AVISO` com nota de prontuário já lançada (permitido?).

### Prontuário

- Salvar nota no minuto 47:59 vs. 48:00:01.
- Duas abas editando a mesma nota dentro de 48h (último write ganha?).
- Tentativa de exclusão (API direta, não só UI).
- Nota vazia / apenas espaços.
- Tamanho máximo do texto.
- Registrar nota com status diferente de REALIZADO.
- Complemento aditivo após 48h: quantos? prazo eterno?

### Lembretes / painel

- Consulta criada há 3h para daqui 3h: não houve lembrete de 24h; alerta de 12h deve aparecer?
- Job de lembrete falha e roda 23h antes (já dentro de 24h): envia mesmo? Botão cancelar ainda vale?
- WhatsApp ok e e-mail falha (ou o inverso): consulta fica “lembrada”?
- Profissional com dezenas de confirmações pendentes: regra de ordenação/limite do alerta.

### Bloqueios e grade

- Bloqueio parcial no meio de um slot (ex.: bloqueio 14:15–14:45, slot 14:00–15:00).
- Alterar intervalo padrão da grade com agenda futura já preenchida.
- Excluir ou encerrar conta do psicólogo com consultas futuras e prontuários.

### Segurança / dados

- Paciente altera a URL/token e acessa consulta de outro.
- Tentativa de ler `anotacaoProntuario` na API pública.
- Troca de e-mail do paciente: lembretes vão para onde?

---

## 5. Critérios de aceite faltando

Há 10 cenários. Cobertura atual: agendar (feliz e <2h), overbooking, bloqueio na listagem pública, cancelar/remarcar paciente (ok e tardio), cancelar psicólogo, lembrete+confirmar, alerta 12h, prontuário (salvar+editar 48h+não excluir).

**Não há cenário de aceite para:**

| Tema | O que a spec já cita |
| --- | --- |
| Cadastro do psicólogo | RN01, funcionalidade de perfil |
| Login / sessão | implícito no painel |
| Configuração da grade | RN02 |
| CRUD de bloqueios | RN03 (só o efeito na grade pública) |
| Configuração presencial vs. online (endereço/link) | RN04 |
| Agendamento **exatamente** 2h e **exatamente** 60 dias | RN05, RN06 |
| Agendamento **além** de 60 dias | RN06 (só o mínimo de 2h tem cenário) |
| Dados obrigatórios faltando no agendamento | RN08 |
| E-mail/WhatsApp inválidos | Cenário 01 diz “válidos” sem o caso negativo |
| Remarcação com novo horário persistido | funcionalidades + RN09/RN11 |
| Cancelamento/remarcação pelo psicólogo com **liberação de vaga** | RN11 (notificação coberta; vaga não) |
| Remarcação pelo psicólogo | RN11 |
| Clique em **Cancelar** no lembrete | Cenário 08 só testa Confirmar |
| Transição para REALIZADO | status existe; Cenário 10 assume que já está Realizado |
| Transição para FALTA_SEM_AVISO | status existe; nunca testado |
| Notas aditivas após 48h | RN14 |
| Tentativa de o paciente (ou API pública) ler prontuário | RN12 |
| Histórico clínico | funcionalidade |
| Taxa de absenteísmo | funcionalidade |
| Falha de envio WhatsApp/e-mail | RN11, RN15, Cenário 01/07/08 |
| Isolamento entre psicólogos | multi-tenant implícito |
| Alteração de grade/bloqueio com consulta já marcada | RN02, RN03 |
| Primeiro acesso do paciente sem senha e fluxo posterior | RN08 |

Também faltam critérios **não funcionais** se forem exigidos: tempo máximo da validação de conflito, comportamento sob carga no Cenário 03, requisitos de criptografia verificáveis (não só “AES-256” no texto).

---

## 6. Perguntas necessárias (para decisão de negócio)

Agrupadas para facilitar resposta. **Não há recomendação de produto neste documento.**

### Cadastro, contas e papéis

1. Existe apenas o psicólogo dono da agenda, ou também clínica com vários profissionais e/ou secretária?
2. O perfil ADMINISTRADOR é só o psicólogo, ou há admin da plataforma?
3. Como o psicólogo autentica (e-mail+senha, magic link, outro)?
4. O paciente terá login algum dia, ou opera só por link/token em e-mail e WhatsApp?
5. Como se identifica que duas consultas são do **mesmo** paciente para histórico e absenteísmo?

### Agenda

6. `dataHoraInicio` / `dataHoraFim` são o horário **da sessão** ou carimbos de execução? Precisa de campos separados?
7. Intervalo padrão = duração da sessão, buffer entre sessões, ou os dois? Quais valores mínimos/máximos?
8. A grade é por modalidade? O paciente escolhe presencial/online?
9. Endereço e link são globais do profissional ou por consulta?
10. Qual fuso horário e como contar 2h, 12h, 24h, 48h e 60 dias corridos (inclusive nos limites exatos)?
11. “Dias úteis” são quais dias, e feriados entram só como bloqueio manual?
12. Bloqueio pode coincidir com consultas já marcadas? O que o sistema faz?
13. Ao cancelar (paciente ou psicólogo), a vaga sempre volta a aparecer no link público?
14. Remarcar altera a mesma consulta ou cancela e cria outra? Quais status e notificações?
15. Cabe 1 consulta por slot apenas?

### Status e automação

16. Quais transições de status são permitidas e quem dispara cada uma?
17. Quem marca REALIZADO e FALTA_SEM_AVISO, e quando (manual vs. job)?
18. No lembrete de 24h, o botão Cancelar segue RN09/RN10 ou é exceção?
19. Consulta pode ocorrer/ser realizada sem ter passado por CONFIRMADO?
20. O e-mail logo após o agendamento (Cenário 01) é requisito oficial? Deve virar RN?
21. Jobs obrigatórios: só 24h (lembrete) e 12h (alerta visual), ou há outros?
22. O que fazer se a consulta for marcada com antecedência entre 2h e 24h (sem lembrete de 24h)?

### Prontuário e dados sensíveis

23. Nota única por consulta ou histórico de versões + notas aditivas? Qual o modelo?
24. As 48h contam a partir de qual evento?
25. Pode haver prontuário só com status REALIZADO?
26. O paciente nunca vê nenhum trecho clínico, inclusive em notificações?
27. Há requisitos LGPD (consentimento, retenção, exclusão vs. prontuário imutável)?
28. AES-256 é requisito de produto verificável em teste; há exigência de onde as chaves ficam?

### Histórico e absenteísmo

29. A funcionalidade de histórico clínico e taxa de absenteísmo entra neste MVP?
30. Se sim: fórmula, período, e se cancelamento tardio / FALTA_SEM_AVISO entram no numerador.

### Canais

31. WhatsApp e e-mail são obrigatórios nos dois sentidos (paciente e profissional) neste MVP? Qual provedor/comportamento se um canal falhar?
32. Formato obrigatório de WhatsApp e se há verificação (OTP)?

### Escopo negativo

33. Cobrança, convênio, prontuário além da nota de evolução, teleconsulta embutida, app mobile nativo: estão **fora** desta spec?

---

## 7. Impacto para implementação (sem decidir regra)

Enquanto as perguntas acima não forem respondidas e refletidas em `specs/`:

- Não há base estável para modelo de dados além de um rascunho da Consulta.
- Vários critérios de aceite dependem de comportamentos não descritos (remarcação, falta, absenteísmo, cadastro, grade).
- Há risco de implementar fluxos (e-mail de “confirmação” no agendamento, botão cancelar do lembrete) que contradizem ou ultrapassam as RNs.

Conforme `AGENTES.md`: dúvidas de negócio também deveriam ir para `specs/duvidas.md` quando esse arquivo for criado. Este relatório não substitui uma atualização oficial da spec.
