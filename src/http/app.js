import Fastify from "fastify";
import { ErroDominio } from "../domain/entidades.js";
import { verificarSaude } from "../application/casos-de-uso.js";

function bearer(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

export async function montarHttp({ casos }) {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ErroDominio) {
      return reply.status(err.httpStatus).send({ mensagem: err.message, codigo: err.codigo });
    }
    return reply.status(500).send({ mensagem: "erro interno" });
  });

  app.get("/health", async () => verificarSaude());

  app.post("/psicologos", async (req, reply) => {
    const criado = casos.cadastrarPsicologo(req.body ?? {});
    return reply.status(201).send(criado);
  });

  app.post("/login", async (req) => casos.login(req.body ?? {}));

  const painel = async (req) => casos.autenticar(bearer(req));

  app.get("/painel/dashboard", async (req) => {
    const id = await painel(req);
    return { consultas: casos.dashboard(id) };
  });

  app.post("/painel/grades", async (req, reply) => {
    const id = await painel(req);
    const grade = casos.salvarGrade(id, req.body ?? {});
    return reply.status(201).send(grade);
  });

  app.get("/painel/grades", async (req) => {
    const id = await painel(req);
    return { grades: casos.listarGrades(id) };
  });

  app.put("/painel/modalidade", async (req) => {
    const id = await painel(req);
    return casos.configurarModalidade(id, req.body ?? {});
  });

  app.post("/painel/bloqueios", async (req, reply) => {
    const id = await painel(req);
    const resultado = casos.criarBloqueio(id, req.body ?? {});
    return reply.status(201).send(resultado);
  });

  app.get("/painel/bloqueios", async (req) => {
    const id = await painel(req);
    return { bloqueios: casos.listarBloqueios(id) };
  });

  app.post("/painel/consultas/:consultaId/cancelar", async (req) => {
    const id = await painel(req);
    return casos.cancelarPeloPsicologo(id, req.params.consultaId);
  });

  app.post("/painel/consultas/:consultaId/remarcar", async (req) => {
    const id = await painel(req);
    return casos.remarcarPeloPsicologo(id, req.params.consultaId, req.body?.dataHoraInicio);
  });

  app.get("/painel/consultas/:consultaId/prontuario", async (req) => {
    const id = await painel(req);
    return casos.obterProntuario(id, req.params.consultaId);
  });

  app.put("/painel/consultas/:consultaId/prontuario", async (req) => {
    const id = await painel(req);
    return casos.salvarNotaPrincipal(id, req.params.consultaId, req.body?.texto);
  });

  app.post("/painel/consultas/:consultaId/notas-aditivas", async (req) => {
    const id = await painel(req);
    return casos.adicionarNotaAditiva(id, req.params.consultaId, req.body?.texto);
  });

  app.delete("/painel/consultas/:consultaId/prontuario", async (req) => {
    await painel(req);
    casos.recusarExclusaoProntuario();
  });

  app.get("/painel/relatorios/absenteismo", async (req) => {
    const id = await painel(req);
    return casos.relatorioAbsenteismo(id, req.query?.cpf);
  });

  app.get("/publico/psicologos/:psicologoId/slots", async (req) => {
    const data = req.query?.data;
    if (!data) throw new ErroDominio("data é obrigatória (YYYY-MM-DD)");
    const iso = String(data).includes("T") ? data : `${data}T00:00:00.000Z`;
    return { slots: casos.listarSlotsPublicos(req.params.psicologoId, iso) };
  });

  app.post("/publico/psicologos/:psicologoId/agendamentos", async (req, reply) => {
    const criado = casos.agendarPublico(req.params.psicologoId, req.body ?? {});
    return reply.status(200).send(criado);
  });

  app.get("/publico/consultas/:token", async (req) => {
    return casos.consultaPublicaPorToken(req.params.token);
  });

  app.post("/publico/consultas/:token/cancelar", async (req) => {
    return casos.cancelarPeloPaciente(req.params.token);
  });

  app.post("/publico/consultas/:token/confirmar", async (req) => {
    return casos.confirmarPeloPaciente(req.params.token);
  });

  return app;
}
