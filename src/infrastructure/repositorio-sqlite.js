import { DatabaseSync } from "node:sqlite";

const DDL = `
CREATE TABLE Psicologo (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  crp TEXT NOT NULL,
  senhaHash TEXT NOT NULL,
  enderecoBase TEXT,
  linkSala TEXT,
  dataHoraCriacao TEXT NOT NULL
);

CREATE TABLE Paciente (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  dataHoraCriacao TEXT NOT NULL
);

CREATE TABLE Consulta (
  id TEXT PRIMARY KEY,
  psicologoId TEXT NOT NULL,
  pacienteId TEXT NOT NULL,
  dataHoraInicio TEXT NOT NULL,
  dataHoraFim TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  localOuLink TEXT NOT NULL,
  status TEXT NOT NULL,
  tokenAcesso TEXT NOT NULL UNIQUE,
  anotacaoProntuario TEXT,
  dataHoraCriacao TEXT NOT NULL,
  dataHoraUltimaAlteracao TEXT NOT NULL,
  FOREIGN KEY (psicologoId) REFERENCES Psicologo(id),
  FOREIGN KEY (pacienteId) REFERENCES Paciente(id)
);

CREATE UNIQUE INDEX idx_consulta_slot_livre
  ON Consulta(psicologoId, dataHoraInicio)
  WHERE status != 'CANCELADO';

CREATE TABLE GradeHoraria (
  id TEXT PRIMARY KEY,
  psicologoId TEXT NOT NULL,
  diaSemana INTEGER NOT NULL,
  horarioInicio TEXT NOT NULL,
  horarioFim TEXT NOT NULL,
  duracaoSessaoMinutos INTEGER NOT NULL,
  intervaloMinutos INTEGER NOT NULL,
  FOREIGN KEY (psicologoId) REFERENCES Psicologo(id)
);

CREATE TABLE BloqueioAgenda (
  id TEXT PRIMARY KEY,
  psicologoId TEXT NOT NULL,
  dataHoraInicio TEXT NOT NULL,
  dataHoraFim TEXT NOT NULL,
  motivo TEXT NOT NULL,
  FOREIGN KEY (psicologoId) REFERENCES Psicologo(id)
);

CREATE TABLE NotaAditiva (
  id TEXT PRIMARY KEY,
  consultaId TEXT NOT NULL,
  textoCifrado TEXT NOT NULL,
  dataHoraAdicao TEXT NOT NULL,
  FOREIGN KEY (consultaId) REFERENCES Consulta(id)
);
`;

export function criarBanco(caminho = ":memory:") {
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(DDL);
  return db;
}

function mapPsicologo(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    whatsapp: row.whatsapp,
    crp: row.crp,
    senhaHash: row.senhaHash,
    enderecoBase: row.enderecoBase,
    linkSala: row.linkSala,
    dataHoraCriacao: row.dataHoraCriacao,
  };
}

function mapConsulta(row) {
  if (!row) return null;
  return { ...row };
}

export class RepositorioSqlite {
  constructor(db) {
    this.db = db;
  }

  inserirPsicologo(p) {
    try {
      this.db
        .prepare(
          `INSERT INTO Psicologo (id, nome, email, whatsapp, crp, senhaHash, enderecoBase, linkSala, dataHoraCriacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          p.id,
          p.nome,
          p.email,
          p.whatsapp,
          p.crp,
          p.senhaHash,
          p.enderecoBase ?? null,
          p.linkSala ?? null,
          p.dataHoraCriacao,
        );
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        const err = new Error("E-mail já cadastrado");
        err.codigo = "EMAIL_DUPLICADO";
        throw err;
      }
      throw e;
    }
  }

  buscarPsicologoPorId(id) {
    return mapPsicologo(this.db.prepare("SELECT * FROM Psicologo WHERE id = ?").get(id));
  }

  buscarPsicologoPorEmail(email) {
    return mapPsicologo(
      this.db.prepare("SELECT * FROM Psicologo WHERE email = ?").get(email.toLowerCase()),
    );
  }

  atualizarModalidade(psicologoId, { enderecoBase, linkSala }) {
    this.db
      .prepare("UPDATE Psicologo SET enderecoBase = ?, linkSala = ? WHERE id = ?")
      .run(enderecoBase, linkSala, psicologoId);
  }

  inserirPaciente(p) {
    try {
      this.db
        .prepare(
          `INSERT INTO Paciente (id, nome, email, whatsapp, cpf, dataHoraCriacao)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(p.id, p.nome, p.email, p.whatsapp, p.cpf, p.dataHoraCriacao);
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        const err = new Error("CPF já cadastrado");
        err.codigo = "CPF_DUPLICADO";
        throw err;
      }
      throw e;
    }
  }

  buscarPacientePorCpf(cpf) {
    const row = this.db.prepare("SELECT * FROM Paciente WHERE cpf = ?").get(cpf);
    return row ?? null;
  }

  buscarPacientePorId(id) {
    return this.db.prepare("SELECT * FROM Paciente WHERE id = ?").get(id) ?? null;
  }

  inserirGrade(g) {
    this.db
      .prepare(
        `INSERT INTO GradeHoraria (id, psicologoId, diaSemana, horarioInicio, horarioFim, duracaoSessaoMinutos, intervaloMinutos)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        g.id,
        g.psicologoId,
        g.diaSemana,
        g.horarioInicio,
        g.horarioFim,
        g.duracaoSessaoMinutos,
        g.intervaloMinutos,
      );
  }

  listarGrades(psicologoId) {
    return this.db
      .prepare("SELECT * FROM GradeHoraria WHERE psicologoId = ?")
      .all(psicologoId);
  }

  inserirBloqueio(b) {
    this.db
      .prepare(
        `INSERT INTO BloqueioAgenda (id, psicologoId, dataHoraInicio, dataHoraFim, motivo)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(b.id, b.psicologoId, b.dataHoraInicio, b.dataHoraFim, b.motivo);
  }

  listarBloqueios(psicologoId) {
    return this.db
      .prepare("SELECT * FROM BloqueioAgenda WHERE psicologoId = ?")
      .all(psicologoId);
  }

  consultasNoIntervalo(psicologoId, inicio, fim) {
    return this.db
      .prepare(
        `SELECT * FROM Consulta
         WHERE psicologoId = ?
           AND status != 'CANCELADO'
           AND dataHoraInicio < ?
           AND dataHoraFim > ?`,
      )
      .all(psicologoId, fim, inicio);
  }

  listarConsultasDoPsicologo(psicologoId) {
    return this.db
      .prepare("SELECT * FROM Consulta WHERE psicologoId = ?")
      .all(psicologoId)
      .map(mapConsulta);
  }

  listarConsultasPorStatus() {
    return this.db.prepare("SELECT * FROM Consulta").all().map(mapConsulta);
  }

  buscarConsultaPorIdDoPsicologo(id, psicologoId) {
    return mapConsulta(
      this.db
        .prepare("SELECT * FROM Consulta WHERE id = ? AND psicologoId = ?")
        .get(id, psicologoId),
    );
  }

  buscarConsultaPorToken(token) {
    return mapConsulta(this.db.prepare("SELECT * FROM Consulta WHERE tokenAcesso = ?").get(token));
  }

  buscarConsultaOcupandoSlot(psicologoId, dataHoraInicio) {
    return mapConsulta(
      this.db
        .prepare(
          `SELECT * FROM Consulta
           WHERE psicologoId = ? AND dataHoraInicio = ? AND status != 'CANCELADO'`,
        )
        .get(psicologoId, dataHoraInicio),
    );
  }

  cpfJaAgendadoNoHorario(cpf, dataHoraInicio) {
    const row = this.db
      .prepare(
        `SELECT c.id FROM Consulta c
         JOIN Paciente p ON p.id = c.pacienteId
         WHERE p.cpf = ? AND c.dataHoraInicio = ? AND c.status != 'CANCELADO'`,
      )
      .get(cpf, dataHoraInicio);
    return Boolean(row);
  }

  transacao(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const resultado = fn();
      this.db.exec("COMMIT");
      return resultado;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  inserirConsulta(c) {
    try {
      this.db
        .prepare(
          `INSERT INTO Consulta (
            id, psicologoId, pacienteId, dataHoraInicio, dataHoraFim, modalidade, localOuLink,
            status, tokenAcesso, anotacaoProntuario, dataHoraCriacao, dataHoraUltimaAlteracao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          c.id,
          c.psicologoId,
          c.pacienteId,
          c.dataHoraInicio,
          c.dataHoraFim,
          c.modalidade,
          c.localOuLink,
          c.status,
          c.tokenAcesso,
          c.anotacaoProntuario,
          c.dataHoraCriacao,
          c.dataHoraUltimaAlteracao,
        );
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        const err = new Error("Horário não mais disponível");
        err.codigo = "SLOT_OCUPADO";
        throw err;
      }
      if (String(e.message).includes("FOREIGN KEY")) {
        const err = new Error("psicologoId ou pacienteId inválido");
        err.codigo = "FK";
        throw err;
      }
      throw e;
    }
  }

  atualizarStatusConsulta(id, status, agoraIso) {
    this.db
      .prepare("UPDATE Consulta SET status = ?, dataHoraUltimaAlteracao = ? WHERE id = ?")
      .run(status, agoraIso, id);
  }

  remarcarConsulta(id, dataHoraInicio, dataHoraFim, agoraIso) {
    try {
      this.db
        .prepare(
          `UPDATE Consulta
           SET dataHoraInicio = ?, dataHoraFim = ?, dataHoraUltimaAlteracao = ?
           WHERE id = ?`,
        )
        .run(dataHoraInicio, dataHoraFim, agoraIso, id);
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        const err = new Error("Horário não mais disponível");
        err.codigo = "SLOT_OCUPADO";
        throw err;
      }
      throw e;
    }
  }

  atualizarAnotacaoCifrada(id, ciphertext, agoraIso) {
    this.db
      .prepare(
        "UPDATE Consulta SET anotacaoProntuario = ?, dataHoraUltimaAlteracao = ? WHERE id = ?",
      )
      .run(ciphertext, agoraIso, id);
  }

  lerAnotacaoBruta(consultaId) {
    const row = this.db
      .prepare("SELECT anotacaoProntuario FROM Consulta WHERE id = ?")
      .get(consultaId);
    return row?.anotacaoProntuario ?? null;
  }

  inserirNotaAditiva(n) {
    this.db
      .prepare(
        `INSERT INTO NotaAditiva (id, consultaId, textoCifrado, dataHoraAdicao)
         VALUES (?, ?, ?, ?)`,
      )
      .run(n.id, n.consultaId, n.textoCifrado, n.dataHoraAdicao);
  }

  listarNotasAditivas(consultaId) {
    return this.db
      .prepare("SELECT * FROM NotaAditiva WHERE consultaId = ? ORDER BY dataHoraAdicao ASC")
      .all(consultaId);
  }

  consultasDoPacienteDoPsicologo(psicologoId, cpf) {
    return this.db
      .prepare(
        `SELECT c.* FROM Consulta c
         JOIN Paciente p ON p.id = c.pacienteId
         WHERE c.psicologoId = ? AND p.cpf = ?`,
      )
      .all(psicologoId, cpf)
      .map(mapConsulta);
  }
}
