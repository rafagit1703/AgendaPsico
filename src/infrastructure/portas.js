export class RelogioFixo {
  constructor(iso) {
    this.atual = new Date(iso);
  }

  agora() {
    return new Date(this.atual.getTime());
  }

  avancarMs(ms) {
    this.atual = new Date(this.atual.getTime() + ms);
  }
}

export class RelogioSistema {
  agora() {
    return new Date();
  }
}

export class CorreioMemoria {
  constructor() {
    this.enviados = [];
  }

  enviar({ para, assunto, corpo }) {
    this.enviados.push({ para, assunto, corpo, canal: "email" });
  }
}

export class WhatsAppMemoria {
  constructor() {
    this.enviados = [];
  }

  enviar({ para, corpo }) {
    this.enviados.push({ para, corpo, canal: "whatsapp" });
  }
}

export class SessoesMemoria {
  constructor() {
    this.porToken = new Map();
  }

  criar(psicologoId, token) {
    this.porToken.set(token, psicologoId);
  }

  psicologoId(token) {
    return this.porToken.get(token) ?? null;
  }
}
