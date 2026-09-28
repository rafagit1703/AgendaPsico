import { randomBytes, randomUUID } from "node:crypto";
import {
  criarBloqueioAgenda,
  criarConsulta,
  criarGradeHoraria,
  criarPaciente,
  criarPsicologo,
  ErroDominio,
  intervalosIntersectam,
  Modalidade,
  StatusConsulta,
  STATUS_OCUPAM_SLOT,
} from "../domain/entidades.js";
import {
  antecedenciaMaximaOk,
  antecedenciaMinimaOk,
  cancelamentoAutonomoPermitido,
  confirmacaoPendente,
  deveDispararLembrete24h,
  edicaoNotaPrincipalPermitida,
  gerarSlotsDaGrade,
  taxaAbsenteismo,
} from "../domain/regras.js";
import { cifrarAes256, decifrarAes256, hashSenha, verificarSenha } from "../infrastructure/crypto.js";

function novoToken() {
  return randomBytes(32).toString("hex");
}

function exigir(condicao, mensagem, status = 400, codigo = "VALIDACAO") {
  if (!condicao) throw new ErroDominio(mensagem, codigo, status);
}

export function verificarSaude() {
  return { status: "ok" };
}

function resolverOfertaModalidade(psicologo) {
  const pres = Boolean(psicologo.enderecoBase);
  const on = Boolean(psicologo.linkSala);
  if (pres && !on) {
    return { modalidade: Modalidade.PRESENCIAL, localOuLink: psicologo.enderecoBase };
  }
  if (on && !pres) {
    return { modalidade: Modalidade.ONLINE, localOuLink: psicologo.linkSala };
  }
  return null;
}

function duracaoDaGradeNoInicio(grades, dataHoraInicioIso) {
  const inicio = new Date(dataHoraInicioIso);
  const dia = inicio.getUTCDay();
  const hh = String(inicio.getUTCHours()).padStart(2, "0");
  const mm = String(inicio.getUTCMinutes()).padStart(2, "0");
  const hora = `${hh}:${mm}`;
  const grade = grades.find((g) => g.diaSemana === dia && g.horarioInicio <= hora && hora < g.horarioFim);
  return grade ?? null;
}

export class CasosDeUso {
  constructor({ repo, relogio, correio, whatsapp, sessoes, chaveAes, urlBase = "http://localhost" }) {
    this.repo = repo;
    this.relogio = relogio;
    this.correio = correio;
    this.whatsapp = whatsapp;
    this.sessoes = sessoes;
    this.chaveAes = chaveAes;
    this.urlBase = urlBase;
  }

  agoraIso() {
    return this.relogio.agora().toISOString();
  }

  cadastrarPsicologo({ nome, email, crp, whatsapp, senha }) {
    exigir(nome && String(nome).trim(), "nome é obrigatório");
    exigir(email && String(email).trim(), "email é obrigatório");
    exigir(crp && String(crp).trim(), "crp é obrigatório");
    exigir(whatsapp && String(whatsapp).trim(), "whatsapp é obrigatório");
    exigir(senha && String(senha).trim(), "senha é obrigatória");
    const psicologo = criarPsicologo({
      id: randomUUID(),
      nome,
      email,
      crp,
      whatsapp,
      dataHoraCriacao: this.agoraIso(),
    });
    try {
      this.repo.inserirPsicologo({ ...psicologo, senhaHash: hashSenha(senha) });
    } catch (e) {
      if (e.codigo === "EMAIL_DUPLICADO") {
        throw new ErroDominio("E-mail já cadastrado", "EMAIL_DUPLICADO", 409);
      }
      throw e;
    }
    return { id: psicologo.id, email: psicologo.email };
  }

  login({ email, senha }) {
    exigir(email && senha, "credenciais inválidas", 401, "AUTH");
    const p = this.repo.buscarPsicologoPorEmail(email);
    if (!p || !verificarSenha(senha, p.senhaHash)) {
      throw new ErroDominio("credenciais inválidas", "AUTH", 401);
    }
    const token = novoToken();
    this.sessoes.criar(p.id, token);
    return { token };
  }

  autenticar(token) {
    const id = token ? this.sessoes.psicologoId(token) : null;
    if (!id) throw new ErroDominio("não autenticado", "AUTH", 401);
    return id;
  }

  salvarGrade(psicologoId, dados) {
    const grade = criarGradeHoraria({
      id: dados.id ?? randomUUID(),
      psicologoId,
      diaSemana: dados.diaSemana,
      horarioInicio: dados.horarioInicio,
      horarioFim: dados.horarioFim,
      duracaoSessaoMinutos: dados.duracaoSessaoMinutos,
      intervaloMinutos: dados.intervaloMinutos,
    });
    this.repo.inserirGrade(grade);
    return grade;
  }

  listarGrades(psicologoId) {
    return this.repo.listarGrades(psicologoId);
  }

  configurarModalidade(psicologoId, body) {
    let enderecoBase = null;
    let linkSala = null;
    if (body.presencial?.ativo) {
      exigir(body.presencial.enderecoBase?.trim(), "endereço base é obrigatório para modalidade presencial");
      enderecoBase = body.presencial.enderecoBase.trim();
    }
    if (body.online?.ativo) {
      exigir(body.online.linkSala?.trim(), "link da sala é obrigatório para modalidade online");
      linkSala = body.online.linkSala.trim();
    }
    this.repo.atualizarModalidade(psicologoId, { enderecoBase, linkSala });
    return { enderecoBase, linkSala };
  }

  criarBloqueio(psicologoId, dados) {
    const bloqueio = criarBloqueioAgenda({
      id: randomUUID(),
      psicologoId,
      dataHoraInicio: dados.dataHoraInicio,
      dataHoraFim: dados.dataHoraFim,
      motivo: dados.motivo,
    });
    this.repo.inserirBloqueio(bloqueio);
    const conflito = this.repo.consultasNoIntervalo(
      psicologoId,
      bloqueio.dataHoraInicio,
      bloqueio.dataHoraFim,
    );
    return {
      bloqueio,
      alerta:
        conflito.length > 0
          ? "Há consultas neste período. Remarque ou cancele antes, se necessário."
          : null,
      consultasEmConflito: conflito.map((c) => ({ id: c.id, status: c.status })),
    };
  }

  listarBloqueios(psicologoId) {
    return this.repo.listarBloqueios(psicologoId);
  }

  listarSlotsPublicos(psicologoId, dataIsoDia) {
    const psicologo = this.repo.buscarPsicologoPorId(psicologoId);
    if (!psicologo) throw new ErroDominio("psicólogo não encontrado", "NAO_ENCONTRADO", 404);
    const oferta = resolverOfertaModalidade(psicologo);
    if (!oferta) return [];

    const dia = new Date(dataIsoDia);
    const diaSemana = dia.getUTCDay();
    const grades = this.repo.listarGrades(psicologoId).filter((g) => g.diaSemana === diaSemana);
    const bloqueios = this.repo.listarBloqueios(psicologoId);
    const consultas = this.repo
      .listarConsultasDoPsicologo(psicologoId)
      .filter((c) => STATUS_OCUPAM_SLOT.includes(c.status));
    const agora = this.relogio.agora();

    const slots = [];
    for (const grade of grades) {
      for (const bruto of gerarSlotsDaGrade(grade, dataIsoDia)) {
        const inicio = new Date(bruto.dataHoraInicio);
        const fim = new Date(bruto.dataHoraFim);
        if (!antecedenciaMinimaOk(inicio, agora)) continue;
        if (!antecedenciaMaximaOk(inicio, agora)) continue;
        const bloqueado = bloqueios.some((b) =>
          intervalosIntersectam(inicio, fim, new Date(b.dataHoraInicio), new Date(b.dataHoraFim)),
        );
        if (bloqueado) continue;
        const ocupado = consultas.some((c) =>
          intervalosIntersectam(inicio, fim, new Date(c.dataHoraInicio), new Date(c.dataHoraFim)),
        );
        if (ocupado) continue;
        slots.push({
          dataHoraInicio: bruto.dataHoraInicio,
          dataHoraFim: bruto.dataHoraFim,
          modalidade: oferta.modalidade,
          localOuLink: oferta.localOuLink,
        });
      }
    }
    return slots;
  }

  agendarPublico(psicologoId, dados) {
    exigir(dados.nome?.trim(), "nome é obrigatório");
    exigir(dados.email?.trim(), "email é obrigatório");
    exigir(dados.cpf?.trim(), "cpf é obrigatório");
    exigir(dados.whatsapp?.trim(), "whatsapp é obrigatório");
    exigir(dados.dataHoraInicio, "dataHoraInicio é obrigatório");

    const agora = this.relogio.agora();
    if (!antecedenciaMinimaOk(dados.dataHoraInicio, agora)) {
      throw new ErroDominio(
        "A antecedência mínima para agendar é de 2 horas.",
        "JANELA_MINIMA",
        400,
      );
    }
    if (!antecedenciaMaximaOk(dados.dataHoraInicio, agora)) {
      throw new ErroDominio("A antecedência máxima para agendar é de 60 dias corridos.", "JANELA_MAXIMA", 400);
    }

    const dia = dados.dataHoraInicio.slice(0, 10);
    const slots = this.listarSlotsPublicos(psicologoId, `${dia}T00:00:00.000Z`);
    const slot = slots.find((s) => s.dataHoraInicio === new Date(dados.dataHoraInicio).toISOString());
    if (!slot) {
      throw new ErroDominio("Horário não mais disponível", "SLOT_OCUPADO", 409);
    }

    if (this.repo.cpfJaAgendadoNoHorario(dados.cpf.trim(), slot.dataHoraInicio)) {
      throw new ErroDominio("CPF já possui consulta neste horário", "CPF_HORARIO", 409);
    }

    const tokenAcesso = novoToken();
    const agoraIso = this.agoraIso();

    try {
      return this.repo.transacao(() => {
        let paciente = this.repo.buscarPacientePorCpf(dados.cpf.trim());
        if (!paciente) {
          paciente = criarPaciente({
            id: randomUUID(),
            nome: dados.nome,
            email: dados.email,
            whatsapp: dados.whatsapp,
            cpf: dados.cpf.trim(),
            dataHoraCriacao: agoraIso,
          });
          this.repo.inserirPaciente(paciente);
        }
        const consulta = criarConsulta({
          id: randomUUID(),
          psicologoId,
          pacienteId: paciente.id,
          dataHoraInicio: slot.dataHoraInicio,
          dataHoraFim: slot.dataHoraFim,
          modalidade: slot.modalidade,
          localOuLink: slot.localOuLink,
          status: StatusConsulta.AGENDADO,
          tokenAcesso,
          anotacaoProntuario: null,
          dataHoraCriacao: agoraIso,
          dataHoraUltimaAlteracao: agoraIso,
        });
        this.repo.inserirConsulta(consulta);
        const link = `${this.urlBase}/publico/consultas/${tokenAcesso}`;
        this.correio.enviar({
          para: dados.email,
          assunto: "Consulta Registrada",
          corpo: `Link de acesso: ${link}`,
        });
        return { id: consulta.id, status: consulta.status, tokenAcesso };
      });
    } catch (e) {
      if (e.codigo === "SLOT_OCUPADO") {
        throw new ErroDominio("Horário não mais disponível", "SLOT_OCUPADO", 409);
      }
      throw e;
    }
  }

  consultaPublicaPorToken(token) {
    const c = this.repo.buscarConsultaPorToken(token);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    const psicologo = this.repo.buscarPsicologoPorId(c.psicologoId);
    return this.visaoPaciente(c, psicologo);
  }

  visaoPaciente(c, psicologo) {
    const agora = this.relogio.agora();
    const podeCancelar = cancelamentoAutonomoPermitido(c.dataHoraInicio, agora);
    return {
      id: c.id,
      dataHoraInicio: c.dataHoraInicio,
      dataHoraFim: c.dataHoraFim,
      modalidade: c.modalidade,
      localOuLink: c.localOuLink,
      status: c.status,
      cancelamentoAutonomoHabilitado: podeCancelar,
      whatsappProfissional: psicologo?.whatsapp ?? null,
    };
  }

  cancelarPeloPaciente(token) {
    const c = this.repo.buscarConsultaPorToken(token);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    if (c.status === StatusConsulta.CANCELADO) {
      throw new ErroDominio("consulta já cancelada", "INVALIDO", 400);
    }
    const psicologo = this.repo.buscarPsicologoPorId(c.psicologoId);
    if (!cancelamentoAutonomoPermitido(c.dataHoraInicio, this.relogio.agora())) {
      throw new ErroDominio(
        `Cancelamento pelo sistema indisponível com menos de 24 horas. Contate o profissional pelo WhatsApp ${psicologo.whatsapp}.`,
        "CANCELAMENTO_TARDIO",
        409,
      );
    }
    this.repo.atualizarStatusConsulta(c.id, StatusConsulta.CANCELADO, this.agoraIso());
    return { status: StatusConsulta.CANCELADO };
  }

  confirmarPeloPaciente(token) {
    const c = this.repo.buscarConsultaPorToken(token);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    if (c.status !== StatusConsulta.AGENDADO) {
      throw new ErroDominio("consulta não está agendada", "INVALIDO", 400);
    }
    this.repo.atualizarStatusConsulta(c.id, StatusConsulta.CONFIRMADO, this.agoraIso());
    return { status: StatusConsulta.CONFIRMADO };
  }

  cancelarPeloPsicologo(psicologoId, consultaId) {
    const c = this.repo.buscarConsultaPorIdDoPsicologo(consultaId, psicologoId);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    this.repo.atualizarStatusConsulta(c.id, StatusConsulta.CANCELADO, this.agoraIso());
    return { status: StatusConsulta.CANCELADO };
  }

  remarcarPeloPsicologo(psicologoId, consultaId, dataHoraInicio) {
    const c = this.repo.buscarConsultaPorIdDoPsicologo(consultaId, psicologoId);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    const dia = new Date(dataHoraInicio).toISOString().slice(0, 10);
    const slots = this.listarSlotsPublicos(psicologoId, `${dia}T00:00:00.000Z`);
    const slot = slots.find((s) => s.dataHoraInicio === new Date(dataHoraInicio).toISOString());
    if (!slot) throw new ErroDominio("Horário não mais disponível", "SLOT_OCUPADO", 409);
    this.repo.transacao(() => {
      this.repo.remarcarConsulta(c.id, slot.dataHoraInicio, slot.dataHoraFim, this.agoraIso());
    });
    const atualizada = this.repo.buscarConsultaPorIdDoPsicologo(consultaId, psicologoId);
    return {
      status: atualizada.status,
      dataHoraInicio: atualizada.dataHoraInicio,
      dataHoraFim: atualizada.dataHoraFim,
    };
  }

  dashboard(psicologoId) {
    const agora = this.relogio.agora();
    return this.repo.listarConsultasDoPsicologo(psicologoId).map((c) => ({
      id: c.id,
      dataHoraInicio: c.dataHoraInicio,
      dataHoraFim: c.dataHoraFim,
      status: c.status,
      tagConfirmacaoPendente: confirmacaoPendente(c, agora) ? "Confirmação Pendente" : null,
    }));
  }

  obterProntuario(psicologoId, consultaId) {
    const c = this.repo.buscarConsultaPorIdDoPsicologo(consultaId, psicologoId);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    const somenteLeitura = !edicaoNotaPrincipalPermitida(c.dataHoraFim, this.relogio.agora());
    const notas = this.repo.listarNotasAditivas(c.id).map((n) => ({
      id: n.id,
      texto: decifrarAes256(n.textoCifrado, this.chaveAes),
      dataHoraAdicao: n.dataHoraAdicao,
    }));
    return {
      consultaId: c.id,
      anotacaoProntuario: decifrarAes256(c.anotacaoProntuario, this.chaveAes),
      somenteLeitura,
      podeAdicionarNotaAditiva: somenteLeitura,
      notasAditivas: notas,
    };
  }

  salvarNotaPrincipal(psicologoId, consultaId, texto) {
    const c = this.repo.buscarConsultaPorIdDoPsicologo(consultaId, psicologoId);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    if (!edicaoNotaPrincipalPermitida(c.dataHoraFim, this.relogio.agora())) {
      throw new ErroDominio("Nota principal somente leitura após 48 horas do término", "PRONTUARIO_BLOQUEADO", 409);
    }
    const cipher = cifrarAes256(texto, this.chaveAes);
    this.repo.atualizarAnotacaoCifrada(c.id, cipher, this.agoraIso());
    return this.obterProntuario(psicologoId, consultaId);
  }

  adicionarNotaAditiva(psicologoId, consultaId, texto) {
    const c = this.repo.buscarConsultaPorIdDoPsicologo(consultaId, psicologoId);
    if (!c) throw new ErroDominio("consulta não encontrada", "NAO_ENCONTRADO", 404);
    if (edicaoNotaPrincipalPermitida(c.dataHoraFim, this.relogio.agora())) {
      throw new ErroDominio("Notas aditivas só após a janela de 48 horas", "PRONTUARIO", 400);
    }
    exigir(texto?.trim(), "texto é obrigatório");
    this.repo.inserirNotaAditiva({
      id: randomUUID(),
      consultaId: c.id,
      textoCifrado: cifrarAes256(texto.trim(), this.chaveAes),
      dataHoraAdicao: this.agoraIso(),
    });
    return this.obterProntuario(psicologoId, consultaId);
  }

  recusarExclusaoProntuario() {
    throw new ErroDominio("Notas de prontuário não podem ser excluídas", "IMUTAVEL", 405);
  }

  relatorioAbsenteismo(psicologoId, cpf) {
    exigir(cpf?.trim(), "cpf é obrigatório");
    const consultas = this.repo.consultasDoPacienteDoPsicologo(psicologoId, cpf.trim());
    return { cpf: cpf.trim(), taxa: taxaAbsenteismo(consultas) };
  }

  dispararLembretes24h() {
    const agora = this.relogio.agora();
    const enviados = [];
    for (const c of this.repo.listarConsultasPorStatus()) {
      if (!deveDispararLembrete24h(c, agora)) continue;
      const paciente = this.repo.buscarPacientePorId(c.pacienteId);
      const confirmar = `${this.urlBase}/publico/consultas/${c.tokenAcesso}/confirmar`;
      const cancelar = `${this.urlBase}/publico/consultas/${c.tokenAcesso}/cancelar`;
      const corpo = `Confirmar Presença: ${confirmar}\nCancelar: ${cancelar}`;
      this.correio.enviar({ para: paciente.email, assunto: "Lembrete de consulta", corpo });
      this.whatsapp.enviar({ para: paciente.whatsapp, corpo });
      enviados.push(c.id);
    }
    return { enviados };
  }
}
