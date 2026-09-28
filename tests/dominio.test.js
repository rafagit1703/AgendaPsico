import { describe, expect, it } from "vitest";
import {
  criarBloqueioAgenda,
  criarConsulta,
  criarGradeHoraria,
  criarPaciente,
  criarPsicologo,
} from "../src/domain/entidades.js";
import { gerarSlotsDaGrade, taxaAbsenteismo } from "../src/domain/regras.js";

describe("entidades", () => {
  it("rejeita psicólogo sem campos obrigatórios", () => {
    expect(() =>
      criarPsicologo({
        id: "1",
        nome: "",
        email: "a@a.com",
        whatsapp: "1",
        crp: "1",
        dataHoraCriacao: new Date().toISOString(),
      }),
    ).toThrow(/nome/);
  });

  it("exige CPF no paciente", () => {
    expect(() =>
      criarPaciente({
        id: "1",
        nome: "A",
        email: "a@a.com",
        whatsapp: "1",
        cpf: "  ",
        dataHoraCriacao: new Date().toISOString(),
      }),
    ).toThrow(/cpf/);
  });

  it("rejeita status e modalidade fora da spec", () => {
    const base = {
      id: "1",
      psicologoId: "p",
      pacienteId: "c",
      dataHoraInicio: "2026-01-01T10:00:00.000Z",
      dataHoraFim: "2026-01-01T10:50:00.000Z",
      localOuLink: "x",
      tokenAcesso: "t",
      dataHoraCriacao: "2026-01-01T00:00:00.000Z",
      dataHoraUltimaAlteracao: "2026-01-01T00:00:00.000Z",
    };
    expect(() => criarConsulta({ ...base, modalidade: "HIBRIDO", status: "AGENDADO" })).toThrow(/modalidade/);
    expect(() => criarConsulta({ ...base, modalidade: "ONLINE", status: "FOI" })).toThrow(/status/);
  });

  it("rejeita diaSemana fora de 0-6", () => {
    expect(() =>
      criarGradeHoraria({
        id: "1",
        psicologoId: "p",
        diaSemana: 7,
        horarioInicio: "08:00",
        horarioFim: "18:00",
        duracaoSessaoMinutos: 50,
        intervaloMinutos: 10,
      }),
    ).toThrow(/diaSemana/);
  });

  it("rejeita bloqueio com fim não posterior ao início", () => {
    expect(() =>
      criarBloqueioAgenda({
        id: "1",
        psicologoId: "p",
        dataHoraInicio: "2026-01-01T12:00:00.000Z",
        dataHoraFim: "2026-01-01T12:00:00.000Z",
        motivo: "x",
      }),
    ).toThrow(/dataHoraFim/);
  });
});

describe("geração de slots", () => {
  it("fatia 08:00-10:00 em 50+10", () => {
    const slots = gerarSlotsDaGrade(
      {
        horarioInicio: "08:00",
        horarioFim: "10:00",
        duracaoSessaoMinutos: 50,
        intervaloMinutos: 10,
      },
      "2026-09-28T00:00:00.000Z",
    );
    expect(slots).toEqual([
      { dataHoraInicio: "2026-09-28T08:00:00.000Z", dataHoraFim: "2026-09-28T08:50:00.000Z" },
      { dataHoraInicio: "2026-09-28T09:00:00.000Z", dataHoraFim: "2026-09-28T09:50:00.000Z" },
    ]);
  });
});

describe("absenteísmo", () => {
  it("ignora canceladas no denominador", () => {
    const taxa = taxaAbsenteismo([
      { status: "FALTA_SEM_AVISO" },
      { status: "REALIZADO" },
      { status: "AGENDADO" },
      { status: "CANCELADO" },
    ]);
    expect(taxa).toBeCloseTo((1 / 3) * 100);
  });
});
