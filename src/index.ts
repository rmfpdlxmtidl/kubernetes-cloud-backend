import cors from '@koa/cors'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { rootRouter } from './api'
import { postRouter } from './api/post/resolvers'
import { userRouter } from './api/user/resolvers'
import { pool } from './database/postgres'
import { verifyJWT } from './utils/jwt'

export type UserContext = {
  userId?: string
}

pool
  .query('SELECT NOW()')
  .then(({ rows }) =>
    console.log('π Connected to PostgreSQL server at ' + new Date(rows[0].now).toLocaleString())
  )
  .catch((error) => {
    throw new Error('PostgreSQL μλ²μ μ μν  μ μμ΅λλ€.' + error)
  })

export const app = new Koa<UserContext>()
const port = process.env.PORT

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})

app.use(cors())
app.use(bodyParser())

const user = 'SELECT id FROM "user" WHERE id = $1 AND logout_time < $2'
app.use(async (ctx, next) => {
  const jwt = ctx.request.header.authorization ?? ''

  if (!jwt) return next()

  const verifiedJwt = await verifyJWT(jwt).catch(() => null)

  if (!verifiedJwt) return next()

  const { rowCount, rows } = await pool.query(user, [
    verifiedJwt.userId,
    new Date(((verifiedJwt.iat ?? 0) + 2) * 1000),
  ])

  // λ‘κ·Έμμ λ±μΌλ‘ μΈν΄ JWTκ° μ ν¨νμ§ μμ λ
  if (rowCount === 0) return next()

  ctx.state = { userId: rows[0].id }
  return next()
})

app.use(rootRouter.routes())
app.use(userRouter.routes())
app.use(postRouter.routes())
