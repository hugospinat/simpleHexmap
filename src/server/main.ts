import { resolve } from "node:path"
import { createMapServer } from "@/server/network/mapServer"

const port = Number(process.env.PORT ?? "3001")
const host = process.env.HOST ?? "127.0.0.1"
const storageDirectory = process.env.MAP_STORAGE_DIR
  ? resolve(process.env.MAP_STORAGE_DIR)
  : resolve(process.cwd(), "data/maps")

const server = createMapServer(storageDirectory)

server.start(port, host).then((address) => {
  console.log(`Map server listening on http://${address.address}:${address.port}`)
})
