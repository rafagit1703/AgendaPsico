const DUAS_HORAS_MS = 2 * 60 * 60 * 1000;
const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
const DOZE_HORAS_MS = 12 * 60 * 60 * 1000;
const QUARENTA_OITO_HORAS_MS = 48 * 60 * 60 * 1000;

export function antecedenciaMinimaOk(dataHoraInicio, agora) {
  return new Date(dataHoraInicio).getTime() - agora.getTime() >= DUAS_HORAS_MS;
}

export function fimDoDiaUtcMaisDias(agora, dias) {
  return new Date(
    Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth(),
      agora.getUTCDate() + dias,
      23,
      59,
      59,
      999,
    ),
  );
}

export function antecedenciaMaximaOk(dataHoraInicio, agora) {
  return new Date(dataHoraInicio).getTime() <= fimDoDiaUtcMaisDias(agora, 60).getTime();
}

export function cancelamentoAutonomoPermitido(dataHoraInicio, agora) {
  return new Date(dataHoraInicio).getTime() - agora.getTime() >= VINTE_QUATRO_HORAS_MS;
}

export function confirmacaoPendente(consulta, agora) {
  if (consulta.status !== "AGENDADO") return false;
  const restante = new Date(consulta.dataHoraInicio).getTime() - agora.getTime();
  return restante <= DOZE_HORAS_MS && restante >= 0;
}

export function edicaoNotaPrincipalPermitida(dataHoraFim, agora) {
  return agora.getTime() <= new Date(dataHoraFim).getTime() + QUARENTA_OITO_HORAS_MS;
}

export function noMesmoMinutoUtc(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate() &&
    da.getUTCHours() === db.getUTCHours() &&
    da.getUTCMinutes() === db.getUTCMinutes()
  );
}

export function deveDispararLembrete24h(consulta, agora) {
  if (consulta.status !== "AGENDADO") return false;
  const alvo = new Date(agora.getTime() + VINTE_QUATRO_HORAS_MS);
  return noMesmoMinutoUtc(consulta.dataHoraInicio, alvo);
}

function parseHHmm(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { h, m };
}

export function combinarDataUtcComHora(dataIsoDia, hhmm) {
  const d = new Date(dataIsoDia);
  const { h, m } = parseHHmm(hhmm);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0, 0));
}

export function gerarSlotsDaGrade(grade, dataIsoDia) {
  const inicioExp = combinarDataUtcComHora(dataIsoDia, grade.horarioInicio);
  const fimExp = combinarDataUtcComHora(dataIsoDia, grade.horarioFim);
  const duracaoMs = grade.duracaoSessaoMinutos * 60 * 1000;
  const passoMs = (grade.duracaoSessaoMinutos + grade.intervaloMinutos) * 60 * 1000;
  const slots = [];
  for (let cursor = inicioExp.getTime(); ; cursor += passoMs) {
    const inicio = new Date(cursor);
    const fim = new Date(cursor + duracaoMs);
    if (fim.getTime() > fimExp.getTime()) break;
    slots.push({ dataHoraInicio: inicio.toISOString(), dataHoraFim: fim.toISOString() });
  }
  return slots;
}

export function taxaAbsenteismo(consultas) {
  const ativas = consultas.filter((c) => c.status !== "CANCELADO");
  if (ativas.length === 0) return 0;
  const faltas = ativas.filter((c) => c.status === "FALTA_SEM_AVISO").length;
  return (faltas / ativas.length) * 100;
}
