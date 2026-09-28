# Dúvidas de regra de negócio

Registradas durante a implementação da primeira versão. **Nenhuma destas dúvidas foi resolvida no código com regra de produto inventada.** Onde a implementação precisou continuar, o comportamento técnico está descrito abaixo de forma explícita (não como decisão de negócio oficial).

---

## D1 — Transições passivas `REALIZADO` e `FALTA_SEM_AVISO` (bloqueante para T054)

**Spec:** perfil SISTEMA (3.3) pode fazer “transições de status passivas”. Os status existem no modelo. Não há RN nem critério de aceite dizendo *quando*, *quem* (job vs. psicólogo) nem a ordem `AGENDADO`/`CONFIRMADO` → `REALIZADO` ou `FALTA_SEM_AVISO`.

**Pergunta:** após `dataHoraFim`, a consulta vira `REALIZADO` automaticamente, `FALTA_SEM_AVISO` se não confirmada, ou permanece até ação humana?

**Implementação:** **não** há job nem rota para mudar para `REALIZADO` / `FALTA_SEM_AVISO`. Testes de prontuário (Cenário 09) e absenteísmo **inserem o status direto na persistência**.

---

## D2 — Duas modalidades ativas no mesmo horário (RN04)

**Spec:** o psicólogo pode configurar Presencial (endereço) e Online (link). O paciente não escolhe o local, “a modalidade oferecida no slot”. Cada consulta tem uma única `modalidade`.

**Pergunta:** se Presencial **e** Online estão ativos, o slot das 14h é presencial, online, os dois (dois itens), ou o psicólogo escolhe a modalidade por faixa da grade?

**Implementação:** a listagem pública só gera slots se **exatamente uma** modalidade estiver completa (endereço **ou** link). Se as duas (ou nenhuma) estiverem configuradas, a lista de slots vem vazia. Não há escolha de modalidade pelo paciente.

---

## D3 — Senha no cadastro (RN01 vs. perfil 3.1)

**Spec:** RN01 obriga Nome, E-mail, CRP e WhatsApp. O perfil ADMINISTRADOR autentica com e-mail e senha. A entidade `Psicologo` não tem campo de senha.

**Pergunta:** a senha é definida no cadastro, num passo seguinte, ou outro fluxo?

**Implementação técnica (não é regra de produto extra):** o cadastro HTTP exige `senha` só para viabilizar o login da seção 3.1. Persiste-se apenas hash, nunca a senha em claro (`docs/tarefas.md` T011).

---

## D4 — Assunto do e-mail após agendar (RN08 vs. Cenário 01)

**RN08:** e-mail de “Confirmação de Agendamento”.  
**Cenário 01:** e-mail de “Consulta Registrada” com token/link.

**Pergunta:** qual o assunto/título oficial?

**Implementação:** assunto **Consulta Registrada**, porque o critério de aceite é o teste obrigatório. O corpo não contém prontuário.

---

## D5 — Fuso horário e “dias corridos”

**Spec:** horários da grade são `Time` sem fuso. Janelas de 2h / 12h / 24h / 48h / 60 dias corridos sem timezone.

**Pergunta:** fuso do profissional, do paciente ou UTC? O limite de 60 dias corridos é a data civil (até 23:59 do 60º dia) ou 60×24 horas a partir do instante atual?

**Implementação técnica:** todos os timestamps em **UTC**. 60 dias corridos = até o fim do dia UTC de `data atual UTC + 60 dias`. Testes fixam o relógio.

---

## D6 — Janela do job de “exatamente 24 horas” (RN16)

**Spec:** lembretes disparados exatamente 24 horas antes.

**Pergunta:** o cron aceita uma janela (ex. mesmo minuto) ou só igualdade ao segundo?

**Implementação técnica:** o job seleciona consultas `AGENDADO` cuja `dataHoraInicio` cai no **mesmo minuto UTC** que `agora + 24 horas`. Testes usam instantes alinhados a esse minuto.

---

## D7 — Notificação quando o psicólogo cancela ou remarca (RN11)

**Spec:** RN11 fala em cancelar/remarcar, status `CANCELADO` e liberação da vaga. Não descreve e-mail/WhatsApp nesse fluxo (diferente de RN08/RN16).

**Pergunta:** o paciente deve ser notificado?

**Implementação:** **não** dispara e-mail/WhatsApp no cancelamento/remarcação pelo psicólogo.

---

## D8 — Formato de CRP, e-mail, WhatsApp e CPF

**Spec:** campos obrigatórios; e-mail único; CPF único para unificar paciente. Não há regex, DDI nem validação de dígitos.

**Pergunta:** quais formatos são válidos?

**Implementação:** apenas presença (string não vazia) e unicidade já descrita. Sem validação de dígito de CPF ou formato de CRP.

---

## D9 — Edição de nota principal antes de `REALIZADO`

**Spec:** Cenário 09 assume status `REALIZADO`. RN14 fala na janela de 48h a partir de `dataHoraFim`, sem exigir status.

**Pergunta:** pode gravar/editar `anotacaoProntuario` com status `AGENDADO`/`CONFIRMADO`?

**Implementação:** a janela usa só `dataHoraFim` + 48h (RN14). Não há filtro extra por status, porque a RN não o exige.

---

## D10 — Conteúdo das mensagens WhatsApp/e-mail de lembrete

**Spec:** canais e botões “Confirmar Presença” e “Cancelar”. Sem texto, templates ou URLs oficiais.

**Implementação técnica:** mensagens mínimas com os dois links de API (`/publico/consultas/:token/confirmar` e `.../cancelar`). Sem template de marketing.
