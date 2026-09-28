export const Modalidade = Object.freeze({
  PRESENCIAL: "PRESENCIAL",
  ONLINE: "ONLINE",
});

export const StatusConsulta = Object.freeze({
  AGENDADO: "AGENDADO",
  CONFIRMADO: "CONFIRMADO",
  REALIZADO: "REALIZADO",
  CANCELADO: "CANCELADO",
  FALTA_SEM_AVISO: "FALTA_SEM_AVISO",
});

export const STATUS_OCUPAM_SLOT = Object.freeze([
  StatusConsulta.AGENDADO,
  StatusConsulta.CONFIRMADO,
  StatusConsulta.REALIZADO,
  StatusConsulta.FALTA_SEM_AVISO,
]);

export class ErroDominio extends Error {
  constructor(mensagem, codigo = "ERRO_DOMINIO", httpStatus = 400) {
    super(mensagem);
    this.codigo = codigo;
    this.httpStatus = httpStatus;
  }
}

function exigirTexto(valor, campo) {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErroDominio(`${campo} é obrigatório`);
  }
  return valor.trim();
}

export function criarPsicologo(dados) {
  return {
    id: exigirTexto(dados.id, "id"),
    nome: exigirTexto(dados.nome, "nome"),
    email: exigirTexto(dados.email, "email").toLowerCase(),
    whatsapp: exigirTexto(dados.whatsapp, "whatsapp"),
    crp: exigirTexto(dados.crp, "crp"),
    dataHoraCriacao: dados.dataHoraCriacao,
    enderecoBase: dados.enderecoBase ?? null,
    linkSala: dados.linkSala ?? null,
  };
}

export function criarPaciente(dados) {
  return {
    id: exigirTexto(dados.id, "id"),
    nome: exigirTexto(dados.nome, "nome"),
    email: exigirTexto(dados.email, "email"),
    whatsapp: exigirTexto(dados.whatsapp, "whatsapp"),
    cpf: exigirTexto(dados.cpf, "cpf"),
    dataHoraCriacao: dados.dataHoraCriacao,
  };
}

export function criarConsulta(dados) {
  if (!Object.values(Modalidade).includes(dados.modalidade)) {
    throw new ErroDominio("modalidade inválida");
  }
  if (!Object.values(StatusConsulta).includes(dados.status)) {
    throw new ErroDominio("status inválido");
  }
  return {
    id: exigirTexto(dados.id, "id"),
    psicologoId: exigirTexto(dados.psicologoId, "psicologoId"),
    pacienteId: exigirTexto(dados.pacienteId, "pacienteId"),
    dataHoraInicio: dados.dataHoraInicio,
    dataHoraFim: dados.dataHoraFim,
    modalidade: dados.modalidade,
    localOuLink: exigirTexto(dados.localOuLink, "localOuLink"),
    status: dados.status,
    tokenAcesso: exigirTexto(dados.tokenAcesso, "tokenAcesso"),
    anotacaoProntuario: dados.anotacaoProntuario ?? null,
    dataHoraCriacao: dados.dataHoraCriacao,
    dataHoraUltimaAlteracao: dados.dataHoraUltimaAlteracao,
  };
}

export function criarGradeHoraria(dados) {
  const diaSemana = Number(dados.diaSemana);
  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    throw new ErroDominio("diaSemana deve estar entre 0 e 6");
  }
  if (dados.duracaoSessaoMinutos == null) {
    throw new ErroDominio("duracaoSessaoMinutos é obrigatório");
  }
  if (dados.intervaloMinutos == null) {
    throw new ErroDominio("intervaloMinutos é obrigatório");
  }
  return {
    id: exigirTexto(dados.id, "id"),
    psicologoId: exigirTexto(dados.psicologoId, "psicologoId"),
    diaSemana,
    horarioInicio: exigirTexto(dados.horarioInicio, "horarioInicio"),
    horarioFim: exigirTexto(dados.horarioFim, "horarioFim"),
    duracaoSessaoMinutos: Number(dados.duracaoSessaoMinutos),
    intervaloMinutos: Number(dados.intervaloMinutos),
  };
}

export function criarBloqueioAgenda(dados) {
  const inicio = new Date(dados.dataHoraInicio);
  const fim = new Date(dados.dataHoraFim);
  if (!(inicio < fim)) {
    throw new ErroDominio("dataHoraFim deve ser posterior a dataHoraInicio");
  }
  return {
    id: exigirTexto(dados.id, "id"),
    psicologoId: exigirTexto(dados.psicologoId, "psicologoId"),
    dataHoraInicio: inicio.toISOString(),
    dataHoraFim: fim.toISOString(),
    motivo: exigirTexto(dados.motivo, "motivo"),
  };
}

export function intervalosIntersectam(aInicio, aFim, bInicio, bFim) {
  return aInicio < bFim && aFim > bInicio;
}
