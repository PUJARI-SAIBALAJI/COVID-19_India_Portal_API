const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

// Database path and initialization
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000')
    })
  } catch (e) {
    console.error(`Connection error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

app.use(express.json())

// Middleware to authenticate JWT Token
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  if (authHeader === undefined) {
    return response.status(401).send('Invalid JWT Token')
  }

  const jwtToken = authHeader.split(' ')[1]
  jwt.verify(jwtToken, 'MY_SECRET_KEY', (error, payload) => {
    if (error) {
      return response.status(401).send('Invalid JWT Token')
    }
    request.username = payload.username
    next()
  })
}

// Login API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`

  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400).send('Invalid user')
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password)
    if (!isPasswordCorrect) {
      response.status(400).send('Invalid password')
    } else {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_KEY')
      response.send({jwtToken})
    }
  }
})

// Get all states
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT state_id AS stateId, state_name AS stateName, population FROM state`
  const states = await db.all(getStatesQuery)
  response.send(states)
})

// Get a specific state
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
    SELECT state_id AS stateId, state_name AS stateName, population 
    FROM state WHERE state_id = ${stateId}`
  const state = await db.get(getStateQuery)
  response.send(state)
})

// Add a district
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const addDistrictQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`

  try {
    await db.run(addDistrictQuery)
    response.send('District Successfully Added')
  } catch (error) {
    console.error(`Error: ${error.message}`)
    response.status(500).send('Failed to Add District')
  }
})

// Get a specific district
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
    SELECT district_id AS districtId, district_name AS districtName, state_id AS stateId,
           cases, cured, active, deaths
    FROM district WHERE district_id = ${districtId}`
    const district = await db.get(getDistrictQuery)
    response.send(district)
  },
)

// Delete a district
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}`
    try {
      await db.run(deleteDistrictQuery)
      response.send('District Removed')
    } catch (error) {
      console.error(`Error: ${error.message}`)
      response.status(500).send('Failed to Remove District')
    }
  },
)

// Update district details
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateDistrictQuery = `
    UPDATE district
    SET district_name = '${districtName}', state_id = ${stateId}, cases = ${cases},
        cured = ${cured}, active = ${active}, deaths = ${deaths}
    WHERE district_id = ${districtId}`

    try {
      await db.run(updateDistrictQuery)
      response.send('District Details Updated')
    } catch (error) {
      console.error(`Error: ${error.message}`)
      response.status(500).send('Failed to Update District')
    }
  },
)

// Get statistics of a state
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatsQuery = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured,
           SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
    FROM district WHERE state_id = ${stateId}`
    const stats = await db.get(getStateStatsQuery)
    response.send(stats)
  },
)

module.exports = app
