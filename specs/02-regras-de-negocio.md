
# REGRAS DE NEGÓCIO

## Cadastro e Configuração
**RN01** - Para cadastro do psicólogo, é obrigatório: Nome, E-mail (único), CRP e WhatsApp. O sistema deve validar duplicidade de e-mail.
**RN02** - A grade de atendimento é configurada indicando dias da semana (0-6), horário de início/fim do expediente, duração da consulta e intervalo técnico (pausa entre sessões).
**RN03** - Bloqueios pontuais (férias/feriados) invalidam a exibição de horários públicos no período exato configurado. Se houver consultas pré-existentes no período, o sistema deve alertar o profissional para remarcá-las ou cancelá-las.
**RN04** - O psicólogo pode configurar modalidade Presencial (exige endereço base) e Online (exige link fixo da sala). O paciente não escolhe o local, mas a modalidade oferecida no slot.

## Agendamento
**RN05** - A antecedência mínima permitida para o paciente agendar uma consulta é de **>= 2 horas** do horário atual.
**RN06** - A antecedência máxima para agendamentos é de **<= 60 dias corridos** a partir da data atual.
**RN07** - Validação de Overbooking: A disponibilidade do horário deve ser travada em transação de banco de dados no momento da confirmação, garantindo a vaga ao primeiro request concluído.
**RN08** - Pacientes preenchem Nome, E-mail, CPF (para unificar histórico) e WhatsApp no agendamento. Não é criada senha. Um e-mail de "Confirmação de Agendamento" é disparado imediatamente após o sucesso.

## Alterações e Cancelamentos
**RN09** - O paciente só pode cancelar de forma autônoma via Magic Link se faltarem **>= 24 horas** para o horário da sessão (o botão de cancelar do lembrete de exatas 24h é válido).
**RN10** - Cancelamentos solicitados por pacientes com **< 24 horas** bloqueiam a ação sistêmica e exibem redirecionamento para o WhatsApp do profissional. A vaga **não** é liberada automaticamente.
**RN11** - O psicólogo pode cancelar ou remarcar a qualquer momento. Ao cancelar (seja paciente ou psicólogo), a vaga é imediatamente liberada na grade pública e o status muda para `CANCELADO`.

## Prontuário, Histórico e Segurança
**RN12** - Anotações de evolução são de acesso exclusivo do psicólogo autenticado e jamais trafegam em APIs públicas ou e-mails.
**RN13** - O campo `anotacaoProntuario` deve ser criptografado na camada de banco de dados ou backend utilizando AES-256 reversível.
**RN14** - A nota principal pode ser editada em até **48 horas contadas a partir do `dataHoraFim`** da sessão. Após esse prazo, a edição é bloqueada e o profissional só pode adicionar "Notas Aditivas" (com carimbo de data/hora da adição).
**RN15** - Taxa de Absenteísmo: O cálculo considera a fórmula `(FALTA_SEM_AVISO / Total de consultas não canceladas) * 100` agrupada pelo CPF do paciente.

## Notificações e Automações
**RN16** - Lembretes automáticos (WhatsApp/E-mail) são disparados **exatamente 24 horas antes** da consulta, contendo botões "Confirmar Presença" e "Cancelar".
**RN17** - Se a consulta estiver com status `AGENDADO` (não confirmado) e faltarem **<= 12 horas** para o início, o sistema fixa um alerta de "Confirmação Pendente" no painel do psicólogo.