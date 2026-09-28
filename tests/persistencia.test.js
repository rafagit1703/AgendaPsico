import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { criarBanco, RepositorioSqlite } from "../src/infrastructure/repositorio-sqlite.js";
import { hashSenha, verificarSenha } from "../src/infrastructure/crypto.js";

function psico(repo, extra = {}) {
  const p = {
    id: extra.id ?? randomUUID(),
    nome: "A",
    email: extra.email ?? `${randomUUID()}@e.com`,
    whatsapp: "1",
    crp: "1",
    senhaHash: extra.senhaHash ?? hashSenha("x"),
    enderecoBase: null,
    linkSala: null,
    dataHoraCriacao: "2026-01-01T00:00:00.000Z",
  };
  repo.inserirPsicologo(p);
  return p;
}

describe("persistência", () => {
  it("e-mail de psicólogo é único", () => {
    const repo = new RepositorioSqlite(criarBanco());
    psico(repo, { email: "a@a.com" });
    expect(() => psico(repo, { email: "a@a.com" })).toThrow(/E-mail/);
  });

  it("não persiste senha em claro e o hash é verificável", () => {
    const repo = new RepositorioSqlite(criarBanco());
    const senha = "segredo-forte";
    const p = psico(repo, { senhaHash: hashSenha(senha) });
    const salvo = repo.buscarPsicologoPorId(p.id);
    expect(JSON.stringify(salvo)).not.toContain(senha);
    expect(verificarSenha(senha, salvo.senhaHash)).toBe(true);
  });

  it("CPF de paciente é único", () => {
    const repo = new RepositorioSqlite(criarBanco());
    const base = {
      nome: "P",
      email: "p@p.com",
      whatsapp: "1",
      dataHoraCriacao: "2026-01-01T00:00:00.000Z",
    };
    repo.inserirPaciente({ id: randomUUID(), cpf: "123", ...base });
    expect(() => repo.inserirPaciente({ id: randomUUID(), cpf: "123", ...base })).toThrow(/CPF/);
  });

  it("consulta exige psicólogo e paciente existentes", () => {
    const repo = new RepositorioSqlite(criarBanco());
    expect(() =>
      repo.inserirConsulta({
        id: randomUUID(),
        psicologoId: randomUUID(),
        pacienteId: randomUUID(),
        dataHoraInicio: "2026-01-02T10:00:00.000Z",
        dataHoraFim: "2026-01-02T10:50:00.000Z",
        modalidade: "ONLINE",
        localOuLink: "x",
        status: "AGENDADO",
        tokenAcesso: randomUUID(),
        anotacaoProntuario: null,
        dataHoraCriacao: "2026-01-01T00:00:00.000Z",
        dataHoraUltimaAlteracao: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(/psicologoId ou pacienteId/);
  });

  it("grade órfã não persiste", () => {
    const repo = new RepositorioSqlite(criarBanco());
    expect(() =>
      repo.inserirGrade({
        id: randomUUID(),
        psicologoId: randomUUID(),
        diaSemana: 1,
        horarioInicio: "08:00",
        horarioFim: "18:00",
        duracaoSessaoMinutos: 50,
        intervaloMinutos: 10,
      }),
    ).toThrow();
  });

  it("bloqueio órfão não persiste", () => {
    const repo = new RepositorioSqlite(criarBanco());
    expect(() =>
      repo.inserirBloqueio({
        id: randomUUID(),
        psicologoId: randomUUID(),
        dataHoraInicio: "2026-01-02T08:00:00.000Z",
        dataHoraFim: "2026-01-02T12:00:00.000Z",
        motivo: "feriado",
      }),
    ).toThrow();
  });

  it("psicólogo A não lista agenda de B", () => {
    const repo = new RepositorioSqlite(criarBanco());
    const a = psico(repo);
    const b = psico(repo);
    repo.inserirGrade({
      id: randomUUID(),
      psicologoId: b.id,
      diaSemana: 1,
      horarioInicio: "08:00",
      horarioFim: "18:00",
      duracaoSessaoMinutos: 50,
      intervaloMinutos: 10,
    });
    expect(repo.listarGrades(a.id)).toHaveLength(0);
    expect(repo.listarGrades(b.id)).toHaveLength(1);
  });
});
