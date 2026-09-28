import { criarAppHttp } from "./composition.js";

const { app } = await criarAppHttp();
const porta = Number(process.env.PORT ?? 3000);
await app.listen({ port: porta, host: "0.0.0.0" });
