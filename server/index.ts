import { createMapServer } from "./createServer";

const port = Number(process.env.PORT ?? 3001);

createMapServer({ port }).then(({ origin }) => {
  console.log(`Map server listening on ${origin}`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
