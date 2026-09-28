
# CRITÉRIOS DE ACEITE

## Cenário 01 - Agendamento Público e Limites de Prazo
**Dado** que o profissional possui horário disponível na grade pública
**E** o paciente tenta agendar um horário para **exatamente 2 horas** à frente, ou até o limite de **60 dias corridos**
**Quando** preencher dados válidos (incluindo CPF não duplicado para o mesmo horário) e confirmar
**Então** o agendamento é salvo com status "Agendado"
**E** um e-mail de "Consulta Registrada" contendo o Token/Link de acesso é disparado.

## Cenário 02 - Falha de Agendamento por Janela Inválida
**Dado** que o paciente selecionou um horário na interface
**Quando** demorar a preencher e o tempo restante para o horário selecionado cair para **1 hora e 59 minutos** no momento do submit
**Então** a API deve rejeitar o agendamento
**E** exibir mensagem informando o limite mínimo de 2 horas.

## Cenário 03 - Concorrência Severa (Overbooking)
**Dado** um único slot disponível às 14h00
**Quando** dois pacientes (A e B) enviarem o formulário de confirmação no mesmo milissegundo
**Então** o banco de dados deve utilizar transação isolada
**E** o paciente A recebe a confirmação (status 200)
**E** o paciente B recebe um erro amigável de "Horário não mais disponível" (status 409).

## Cenário 04 - Respeito aos Bloqueios de Agenda
**Dado** que existe um `BloqueioAgenda` das 08:00 às 12:00 de amanhã
**Quando** o paciente renderizar o link público para amanhã
**Então** os slots de 08h às 12h não devem constar no payload retornado, mesmo que a `GradeHoraria` padrão indique disponibilidade.

## Cenário 05 - Cancelamento Autônomo e Liberação de Vaga
**Dado** que faltam 48 horas para a sessão
**Quando** o paciente acessar seu Magic Link e clicar em "Cancelar Consulta"
**Então** o status da consulta muda para `CANCELADO`
**E** o slot de horário volta a ficar instantaneamente disponível no agendamento público.

## Cenário 06 - Proteção Contra Cancelamento Tardio
**Dado** que faltam 23 horas para a sessão (após o disparo do lembrete)
**Quando** o paciente acessar o link e tentar cancelar
**Então** o botão de cancelamento via sistema deve estar desabilitado ou interceptar a ação
**E** exibir a mensagem forçando o contato direto pelo WhatsApp do psicólogo.

## Cenário 07 - Fluxo de Confirmação pelo Lembrete
**Dado** que faltam exatamente 24 horas para uma consulta status `AGENDADO`
**Quando** o CronJob do sistema for executado
**Então** ele envia o Lembrete via e-mail e WhatsApp
**E** quando o paciente clicar no link "Confirmar Presença", a API altera o status para `CONFIRMADO`.

## Cenário 08 - Alerta Visual no Painel (12 horas)
**Dado** que faltam 11h59 para uma consulta
**E** o status atual permanece `AGENDADO` (paciente ignorou lembrete)
**Quando** o psicólogo carregar seu painel (Dashboard)
**Então** essa consulta deve estar sinalizada de forma destacada com a tag "Confirmação Pendente".

## Cenário 09 - Bloqueio de Edição do Prontuário (Nota Aditiva)
**Dado** que a consulta ocorreu há 49 horas (status `REALIZADO`)
**Quando** o psicólogo abrir o painel de prontuário
**Então** o campo principal de `anotacaoProntuario` deve estar em formato *Read-Only* (somente leitura)
**E** deve existir a opção "Adicionar Nota Aditiva" para inserção de novos textos em anexo.

## Cenário 10 - Segurança do Prontuário
**Dado** que o psicólogo salvou uma anotação clínica
**Quando** um administrador de banco de dados ler a tabela `Consulta` diretamente via SQL
**Então** o conteúdo da coluna `anotacaoProntuario` deve ser uma string ilegível (Hash/Encrypted Base64) e não texto plano.