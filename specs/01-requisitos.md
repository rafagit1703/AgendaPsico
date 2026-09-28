
# SPEC - AgendaPsico

## 1. Visão Geral do Produto
Plataforma web para psicólogos autônomos gerenciarem agendamentos, reduzirem a taxa de absenteísmo através de automações de lembretes e registrarem prontuários clínicos criptografados.

---

## 2. Modelo de Dados (Entidades)

### 2.1 Psicologo (Profissional)
- `id`: UUID (PK)
- `nome`: String
- `email`: String (Unique)
- `whatsapp`: String
- `crp`: String (Registro Profissional)
- `dataHoraCriacao`: Timestamp (Auditoria do sistema)

### 2.2 Paciente
- `id`: UUID (PK)
- `nome`: String
- `email`: String
- `whatsapp`: String
- `cpf`: String (Unique - chave primária de negócio para histórico e cálculo de absenteísmo)
- `dataHoraCriacao`: Timestamp (Auditoria do sistema)

### 2.3 Consulta (Agendamento)
- `id`: UUID (PK)
- `psicologoId`: UUID (FK -> Psicologo.id)
- `pacienteId`: UUID (FK -> Paciente.id)
- `dataHoraInicio`: Timestamp (Horário **agendado** de início da sessão)
- `dataHoraFim`: Timestamp (Horário **agendado** de término da sessão)
- `modalidade`: Enum (`PRESENCIAL`, `ONLINE`)
- `localOuLink`: String (Endereço físico do consultório ou URL da sala virtual)
- `status`: Enum (`AGENDADO`, `CONFIRMADO`, `REALIZADO`, `CANCELADO`, `FALTA_SEM_AVISO`)
- `tokenAcesso`: String (Hash único para gerenciamento autônomo pelo paciente)
- `anotacaoProntuario`: Text (Criptografado com AES-256)
- `dataHoraCriacao`: Timestamp (Auditoria do sistema - quando o agendamento foi feito)
- `dataHoraUltimaAlteracao`: Timestamp (Auditoria do sistema)

### 2.4 GradeHoraria (Disponibilidade)
- `id`: UUID (PK)
- `psicologoId`: UUID (FK -> Psicologo.id)
- `diaSemana`: Int (0 = Domingo, 6 = Sábado)
- `horarioInicio`: Time (ex: 08:00)
- `horarioFim`: Time (ex: 18:00)
- `duracaoSessaoMinutos`: Int (ex: 50)
- `intervaloMinutos`: Int (ex: 10 - pausa técnica entre sessões)

### 2.5 BloqueioAgenda
- `id`: UUID (PK)
- `psicologoId`: UUID (FK -> Psicologo.id)
- `dataHoraInicio`: Timestamp
- `dataHoraFim`: Timestamp
- `motivo`: String (ex: Férias, Feriado, Compromisso Pessoal)

---

## 3. Perfis e Controle de Acesso

### 3.1 ADMINISTRADOR (Psicólogo)
- Autenticação via e-mail e senha.
- Acesso completo ao painel de controle, agenda, prontuários, configurações de grade e relatórios.

### 3.2 PACIENTE (Cliente)
- Acesso sem necessidade de senha prévia (Token/Magic Link).
- Agendamento inicial via formulário público.
- Recebe link seguro com `tokenAcesso` via E-mail/WhatsApp para gerenciar a consulta.

### 3.3 SISTEMA (Automação / Cron Jobs)
- Processo em segundo plano (Jobs/Workers) restrito ao disparo de lembretes, atualização de alertas visuais e transições de status passivas.