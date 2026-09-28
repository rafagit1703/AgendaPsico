import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { StatusConsulta } from "../src/domain/entidades.js";
import { cifrarAes256 } from "../src/infrastructure/crypto.js";
import {
  AGORA_PADRAO,
  agendar,
  cadastrarELogar,
  configurarAgendaBasica,
  inserirConsultaDireta,
  sistemaTeste,
} from "./helpers.js";

const apps = [];

async function boot(iso) {
  const s = await sistemaTeste(iso);
  apps.push(s.app);
  return s;
}

afterEach(async () => {
  while (apps.length) {
    const app = apps.pop();
    await app.close();
  }
});

describe("fundação", () => {
  it("GET /health usa o caso de uso e retorna ok", async () => {
    const { app } = await boot();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });
});

describe("cadastro e autenticação", () => {
  it("rejeita cadastro com campo obrigatório ausente", async () => {
    const { app } = await boot();
    for (const payload of [
      { email: "a@a.com", crp: "1", whatsapp: "1", senha: "s" },
      { nome: "A", crp: "1", whatsapp: "1", senha: "s" },
      { nome: "A", email: "a@a.com", whatsapp: "1", senha: "s" },
      { nome: "A", email: "a@a.com", crp: "1", senha: "s" },
    ]) {
      const res = await app.inject({ method: "POST", url: "/psicologos", payload });
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejeita e-mail duplicado", async () => {
    const { app } = await boot();
    const payload = { nome: "A", email: "dup@a.com", crp: "1", whatsapp: "1", senha: "s" };
    expect((await app.inject({ method: "POST", url: "/psicologos", payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/psicologos", payload })).statusCode).toBe(409);
  });

  it("login válido emite token e inválido é 401; painel exige auth", async () => {
    const { app } = await boot();
    await app.inject({
      method: "POST",
      url: "/psicologos",
      payload: { nome: "A", email: "l@a.com", crp: "1", whatsapp: "1", senha: "ok" },
    });
    const ok = await app.inject({ method: "POST", url: "/login", payload: { email: "l@a.com", senha: "ok" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBeTruthy();
    const bad = await app.inject({ method: "POST", url: "/login", payload: { email: "l@a.com", senha: "no" } });
    expect(bad.statusCode).toBe(401);
    const dash = await app.inject({ method: "GET", url: "/painel/dashboard" });
    expect(dash.statusCode).toBe(401);
  });
});

describe("grade, modalidade e bloqueio", () => {
  it("salva grade e configura modalidade com endereço/link obrigatórios", async () => {
    const { app } = await boot();
    const { headers } = await cadastrarELogar(app);
    const semEndereco = await app.inject({
      method: "PUT",
      url: "/painel/modalidade",
      headers,
      payload: { presencial: { ativo: true } },
    });
    expect(semEndereco.statusCode).toBe(400);
    const semLink = await app.inject({
      method: "PUT",
      url: "/painel/modalidade",
      headers,
      payload: { online: { ativo: true } },
    });
    expect(semLink.statusCode).toBe(400);
    await app.inject({
      method: "PUT",
      url: "/painel/modalidade",
      headers,
      payload: { presencial: { ativo: true, enderecoBase: "Rua A, 100" } },
    });
    const grade = await app.inject({
      method: "POST",
      url: "/painel/grades",
      headers,
      payload: {
        diaSemana: 1,
        horarioInicio: "08:00",
        horarioFim: "18:00",
        duracaoSessaoMinutos: 50,
        intervaloMinutos: 10,
      },
    });
    expect(grade.statusCode).toBe(201);
    const lista = await app.inject({ method: "GET", url: "/painel/grades", headers });
    expect(lista.json().grades).toHaveLength(1);
    expect(lista.json().grades[0].duracaoSessaoMinutos).toBe(50);
  });

  it("alerta se bloqueio cobre consulta existente sem cancelá-la", async () => {
    const { app, repo } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const criado = await agendar(app, psicologoId, { dataHoraInicio: "2026-09-28T14:00:00.000Z" });
    expect(criado.statusCode).toBe(200);
    const bloq = await app.inject({
      method: "POST",
      url: "/painel/bloqueios",
      headers,
      payload: {
        dataHoraInicio: "2026-09-28T13:00:00.000Z",
        dataHoraFim: "2026-09-28T15:00:00.000Z",
        motivo: "compromisso",
      },
    });
    expect(bloq.statusCode).toBe(201);
    expect(bloq.json().alerta).toMatch(/consultas/i);
    expect(repo.buscarConsultaPorToken(criado.json().tokenAcesso).status).toBe("AGENDADO");
  });
});

describe("Cenário 01 — agendamento e limites", () => {
  it("aceita exatamente +2h e envia e-mail Consulta Registrada com token", async () => {
    const { app, correio } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const res = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T14:00:00.000Z",
      cpf: "22222222222",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("AGENDADO");
    expect(res.json().tokenAcesso).toBeTruthy();
    expect(correio.enviados).toHaveLength(1);
    expect(correio.enviados[0].assunto).toBe("Consulta Registrada");
    expect(correio.enviados[0].corpo).toContain(res.json().tokenAcesso);
  });

  it("aceita limite de 60 dias corridos e rejeita o 61º", async () => {
    const { app } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 5);
    const ok = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-11-27T10:00:00.000Z",
      cpf: "33333333333",
    });
    expect(ok.statusCode).toBe(200);
    const { headers: h2, psicologoId: id2 } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, h2, 6);
    const fail = await agendar(app, id2, {
      dataHoraInicio: "2026-11-28T10:00:00.000Z",
      cpf: "44444444444",
    });
    expect(fail.statusCode).toBe(400);
  });

  it("unifica paciente por CPF e recusa o mesmo CPF no mesmo horário", async () => {
    const { app, repo } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const a = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T14:00:00.000Z",
      cpf: "55555555555",
      email: "um@e.com",
    });
    const b = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T15:00:00.000Z",
      cpf: "55555555555",
      email: "um@e.com",
    });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    const pacientes = repo.db.prepare("SELECT * FROM Paciente WHERE cpf = ?").all("55555555555");
    expect(pacientes).toHaveLength(1);
    const dup = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T14:00:00.000Z",
      cpf: "55555555555",
    });
    expect(dup.statusCode).toBe(409);
  });
});

describe("Cenário 02 — janela inválida no submit", () => {
  it("rejeita quando restam 1h59", async () => {
    const { app, relogio } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    relogio.avancarMs(60 * 1000);
    const res = await agendar(app, psicologoId, { dataHoraInicio: "2026-09-28T14:00:00.000Z" });
    expect(res.statusCode).toBe(400);
    expect(res.json().mensagem).toMatch(/2 horas/i);
  });
});

describe("Cenário 03 — overbooking", () => {
  it("um 200 e um 409 no mesmo slot", async () => {
    const { app } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const [a, b] = await Promise.all([
      agendar(app, psicologoId, {
        dataHoraInicio: "2026-09-28T14:00:00.000Z",
        cpf: "66666666666",
        email: "a@e.com",
      }),
      agendar(app, psicologoId, {
        dataHoraInicio: "2026-09-28T14:00:00.000Z",
        cpf: "77777777777",
        email: "b@e.com",
      }),
    ]);
    const codes = [a.statusCode, b.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const falha = a.statusCode === 409 ? a : b;
    expect(falha.json().mensagem).toBe("Horário não mais disponível");
  });
});

describe("Cenário 04 — bloqueios na grade pública", () => {
  it("omite slots que intersectam o bloqueio de amanhã 08-12", async () => {
    const { app } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 2);
    await app.inject({
      method: "POST",
      url: "/painel/bloqueios",
      headers,
      payload: {
        dataHoraInicio: "2026-09-29T08:00:00.000Z",
        dataHoraFim: "2026-09-29T12:00:00.000Z",
        motivo: "feriado",
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/publico/psicologos/${psicologoId}/slots?data=2026-09-29`,
    });
    const inicios = res.json().slots.map((s) => s.dataHoraInicio);
    expect(inicios.some((i) => i >= "2026-09-29T08:00:00.000Z" && i < "2026-09-29T12:00:00.000Z")).toBe(
      false,
    );
    expect(inicios).toContain("2026-09-29T12:00:00.000Z");
    expect(res.json().slots[0].modalidade).toBe("PRESENCIAL");
    expect(res.json().slots[0].localOuLink).toBe("Rua A, 100");
  });
});

describe("Cenários 05 e 06 — cancelamento do paciente", () => {
  it("com 48h cancela, libera vaga; e-mail público não traz prontuário", async () => {
    const { app, repo, chaveAes } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 3);
    const criado = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-30T14:00:00.000Z",
      cpf: "88888888888",
    });
    const token = criado.json().tokenAcesso;
    repo.atualizarAnotacaoCifrada(criado.json().id, cifrarAes256("secreto clínico", chaveAes), AGORA_PADRAO);
    const visao = await app.inject({ method: "GET", url: `/publico/consultas/${token}` });
    expect(visao.json().anotacaoProntuario).toBeUndefined();
    expect(visao.json().notasAditivas).toBeUndefined();
    const cancel = await app.inject({ method: "POST", url: `/publico/consultas/${token}/cancelar` });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().status).toBe("CANCELADO");
    const slots = await app.inject({
      method: "GET",
      url: `/publico/psicologos/${psicologoId}/slots?data=2026-09-30`,
    });
    expect(slots.json().slots.map((s) => s.dataHoraInicio)).toContain("2026-09-30T14:00:00.000Z");
  });

  it("com 23h intercepta e aponta WhatsApp sem liberar vaga", async () => {
    const { app } = await boot("2026-09-28T15:01:00.000Z");
    const { headers, psicologoId } = await cadastrarELogar(app, { whatsapp: "11911112222" });
    await configurarAgendaBasica(app, headers, [1, 2]);
    const criado = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-29T14:00:00.000Z",
      cpf: "99999999999",
    });
    expect(criado.statusCode).toBe(200);
    const token = criado.json().tokenAcesso;
    const cancel = await app.inject({ method: "POST", url: `/publico/consultas/${token}/cancelar` });
    expect(cancel.statusCode).toBe(409);
    expect(cancel.json().mensagem).toMatch(/11911112222/);
    const slots = await app.inject({
      method: "GET",
      url: `/publico/psicologos/${psicologoId}/slots?data=2026-09-29`,
    });
    expect(slots.json().slots.map((s) => s.dataHoraInicio)).not.toContain("2026-09-29T14:00:00.000Z");
  });

  it("exatamente 24h permite cancelamento autônomo", async () => {
    const { app } = await boot("2026-09-28T14:00:00.000Z");
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, [1, 2]);
    const criado = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-29T14:00:00.000Z",
      cpf: "10101010101",
    });
    const cancel = await app.inject({
      method: "POST",
      url: `/publico/consultas/${criado.json().tokenAcesso}/cancelar`,
    });
    expect(cancel.statusCode).toBe(200);
  });
});

describe("Cenário 07 — lembrete 24h", () => {
  it("envia e-mail e WhatsApp no minuto certo e confirma presença", async () => {
    const { app, casos, correio, whatsapp } = await boot("2026-09-28T14:00:00.000Z");
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, [1, 2]);
    const criado = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-29T14:00:00.000Z",
      cpf: "12121212121",
    });
    const token = criado.json().tokenAcesso;
    casos.dispararLembretes24h();
    expect(correio.enviados.filter((e) => e.assunto === "Lembrete de consulta")).toHaveLength(1);
    expect(whatsapp.enviados).toHaveLength(1);
    expect(whatsapp.enviados[0].corpo).toMatch(/Confirmar Presença/);
    expect(whatsapp.enviados[0].corpo).toMatch(/Cancelar/);
    const conf = await app.inject({ method: "POST", url: `/publico/consultas/${token}/confirmar` });
    expect(conf.json().status).toBe("CONFIRMADO");
  });

  it("não dispara para +23h nem +25h e não altera prontuário", async () => {
    const { app, casos, correio, whatsapp, repo, chaveAes } = await boot("2026-09-28T14:00:00.000Z");
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, [1, 2]);
    const c23 = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-29T13:00:00.000Z",
      cpf: "13131313131",
    });
    const c25 = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-29T15:00:00.000Z",
      cpf: "14141414141",
    });
    const cipher = cifrarAes256("nota", chaveAes);
    repo.atualizarAnotacaoCifrada(c23.json().id, cipher, AGORA_PADRAO);
    correio.enviados.length = 0;
    whatsapp.enviados.length = 0;
    casos.dispararLembretes24h();
    expect(correio.enviados.filter((e) => e.assunto === "Lembrete de consulta")).toHaveLength(0);
    expect(whatsapp.enviados).toHaveLength(0);
    expect(repo.lerAnotacaoBruta(c23.json().id)).toBe(cipher);
    expect(c25.statusCode).toBe(200);
  });
});

describe("Cenário 08 — dashboard 12h", () => {
  it("marca Confirmação Pendente em AGENDADO com 11h59 e não em CONFIRMADO", async () => {
    const { app } = await boot("2026-09-28T02:01:00.000Z");
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const a = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T14:00:00.000Z",
      cpf: "15151515151",
    });
    const b = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T15:00:00.000Z",
      cpf: "16161616161",
    });
    await app.inject({ method: "POST", url: `/publico/consultas/${b.json().tokenAcesso}/confirmar` });
    const dash = await app.inject({ method: "GET", url: "/painel/dashboard", headers });
    const consultas = dash.json().consultas;
    const pendente = consultas.find((c) => c.id === a.json().id);
    const ok = consultas.find((c) => c.id === b.json().id);
    expect(pendente.tagConfirmacaoPendente).toBe("Confirmação Pendente");
    expect(ok.tagConfirmacaoPendente).toBeNull();
  });
});

describe("cancelar e remarcar pelo psicólogo", () => {
  it("cancela, libera vaga; remarca sem CANCELADO", async () => {
    const { app } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const a = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T14:00:00.000Z",
      cpf: "17171717171",
    });
    const cancel = await app.inject({
      method: "POST",
      url: `/painel/consultas/${a.json().id}/cancelar`,
      headers,
    });
    expect(cancel.json().status).toBe("CANCELADO");
    const slots = await app.inject({
      method: "GET",
      url: `/publico/psicologos/${psicologoId}/slots?data=2026-09-28`,
    });
    expect(slots.json().slots.map((s) => s.dataHoraInicio)).toContain("2026-09-28T14:00:00.000Z");
    const b = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T15:00:00.000Z",
      cpf: "18181818181",
    });
    const rem = await app.inject({
      method: "POST",
      url: `/painel/consultas/${b.json().id}/remarcar`,
      headers,
      payload: { dataHoraInicio: "2026-09-28T16:00:00.000Z" },
    });
    expect(rem.json().status).toBe("AGENDADO");
    expect(rem.json().dataHoraInicio).toBe("2026-09-28T16:00:00.000Z");
    const slots2 = await app.inject({
      method: "GET",
      url: `/publico/psicologos/${psicologoId}/slots?data=2026-09-28`,
    });
    const inicios = slots2.json().slots.map((s) => s.dataHoraInicio);
    expect(inicios).toContain("2026-09-28T15:00:00.000Z");
    expect(inicios).not.toContain("2026-09-28T16:00:00.000Z");
  });
});

describe("Cenários 09 e 10 — prontuário", () => {
  it("cifra AES-256 na coluna; edição 48h; aditiva após 49h; sem exclusão; outro psico 404", async () => {
    const { app, repo, chaveAes, relogio } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    await configurarAgendaBasica(app, headers, 1);
    const criado = await agendar(app, psicologoId, {
      dataHoraInicio: "2026-09-28T14:00:00.000Z",
      cpf: "19191919191",
    });
    const consultaId = criado.json().id;
    repo.atualizarStatusConsulta(consultaId, StatusConsulta.REALIZADO, AGORA_PADRAO);
    repo.db
      .prepare("UPDATE Consulta SET dataHoraFim = ? WHERE id = ?")
      .run("2026-09-28T10:00:00.000Z", consultaId);

    const save = await app.inject({
      method: "PUT",
      url: `/painel/consultas/${consultaId}/prontuario`,
      headers,
      payload: { texto: "evolução visível" },
    });
    expect(save.statusCode).toBe(200);
    const bruto = repo.lerAnotacaoBruta(consultaId);
    expect(bruto).toBeTruthy();
    expect(bruto).not.toContain("evolução visível");

    relogio.atual = new Date("2026-09-30T09:59:00.000Z");
    const ainda = await app.inject({
      method: "PUT",
      url: `/painel/consultas/${consultaId}/prontuario`,
      headers,
      payload: { texto: "ainda na janela" },
    });
    expect(ainda.statusCode).toBe(200);

    relogio.atual = new Date("2026-09-30T10:01:00.000Z");
    const tarde = await app.inject({
      method: "PUT",
      url: `/painel/consultas/${consultaId}/prontuario`,
      headers,
      payload: { texto: "tarde" },
    });
    expect(tarde.statusCode).toBe(409);

    relogio.atual = new Date("2026-09-30T11:00:00.000Z");
    const get = await app.inject({
      method: "GET",
      url: `/painel/consultas/${consultaId}/prontuario`,
      headers,
    });
    expect(get.json().somenteLeitura).toBe(true);
    expect(get.json().anotacaoProntuario).toBe("ainda na janela");

    const aditiva = await app.inject({
      method: "POST",
      url: `/painel/consultas/${consultaId}/notas-aditivas`,
      headers,
      payload: { texto: "adendo" },
    });
    expect(aditiva.statusCode).toBe(200);
    expect(aditiva.json().anotacaoProntuario).toBe("ainda na janela");
    expect(aditiva.json().notasAditivas[0].texto).toBe("adendo");
    expect(aditiva.json().notasAditivas[0].dataHoraAdicao).toBeTruthy();

    const del = await app.inject({
      method: "DELETE",
      url: `/painel/consultas/${consultaId}/prontuario`,
      headers,
    });
    expect(del.statusCode).toBe(405);

    const outro = await cadastrarELogar(app);
    const inv = await app.inject({
      method: "GET",
      url: `/painel/consultas/${consultaId}/prontuario`,
      headers: outro.headers,
    });
    expect(inv.statusCode).toBe(404);
    expect(JSON.stringify(inv.json())).not.toContain(bruto);
    expect(chaveAes.length).toBe(32);
  });
});

describe("absenteísmo", () => {
  it("calcula por CPF só com consultas do psicólogo autenticado", async () => {
    const { app, repo } = await boot();
    const { headers, psicologoId } = await cadastrarELogar(app);
    const pacienteId = randomUUID();
    repo.inserirPaciente({
      id: pacienteId,
      nome: "P",
      email: "p@e.com",
      whatsapp: "1",
      cpf: "20202020202",
      dataHoraCriacao: AGORA_PADRAO,
    });
    const base = {
      psicologoId,
      pacienteId,
      dataHoraFim: "2026-09-01T11:00:00.000Z",
    };
    inserirConsultaDireta(repo, {
      ...base,
      dataHoraInicio: "2026-09-01T10:00:00.000Z",
      status: StatusConsulta.FALTA_SEM_AVISO,
    });
    inserirConsultaDireta(repo, {
      ...base,
      dataHoraInicio: "2026-09-02T10:00:00.000Z",
      status: StatusConsulta.REALIZADO,
    });
    inserirConsultaDireta(repo, {
      ...base,
      dataHoraInicio: "2026-09-03T10:00:00.000Z",
      status: StatusConsulta.AGENDADO,
    });
    inserirConsultaDireta(repo, {
      ...base,
      dataHoraInicio: "2026-09-04T10:00:00.000Z",
      status: StatusConsulta.CANCELADO,
    });
    const res = await app.inject({
      method: "GET",
      url: "/painel/relatorios/absenteismo?cpf=20202020202",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().taxa).toBeCloseTo((1 / 3) * 100);
    const sem = await app.inject({ method: "GET", url: "/painel/relatorios/absenteismo?cpf=20202020202" });
    expect(sem.statusCode).toBe(401);
  });
});
