const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Sever is starting at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};

initializeDbAndServer();

// Register API

app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * 
                            FROM user
                            WHERE username = '${username}';`;
  const selectedUser = await db.get(selectUserQuery);

  if (selectedUser != undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 5) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const createNewUserQuery = `INSERT INTO user(username,name,password,gender,location)
                                  VALUES('${username}','${name}','${hashedPassword}','${gender}','${location}')
                                  `;
    const newUser = await db.run(createNewUserQuery);
    response.status(200);
    response.send("User created successfully");
  }
});

//Login API

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `SELECT *
                            FROM user
                            WHERE username = '${username}';`;
  const checkUser = await db.get(checkUserQuery);

  if (checkUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      checkUser.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "nnmmii");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "nnmmii", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateTable = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const listOfStatesQuery = `SELECT *
                                FROM state`;
  const listOfStates = await db.all(listOfStatesQuery);
  response.send(listOfStates.map((eachState) => convertStateTable(eachState)));
});

//API 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT *
                            FROM state
                            WHERE state_id = ${stateId};`;
  const getState = await db.get(getStateQuery);
  response.send({
    stateId: getState.state_id,
    stateName: getState.state_name,
    population: getState.population,
  });
});

//API 4

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  console.log(districtName, stateId);
  const createDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
                                VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;
  const createDistrict = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT *
                              FROM district
                              WHERE district_id = ${districtId};`;
    const getDistrict = await db.get(getDistrictQuery);
    response.send({
      districtId: getDistrict.district_id,
      districtName: getDistrict.district_name,
      stateId: getDistrict.state_id,
      cases: getDistrict.cases,
      cured: getDistrict.cured,
      active: getDistrict.active,
      deaths: getDistrict.deaths,
    });
  }
);

//API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district
                                WHERE district_id = ${districtId};`;
    const deleteDistrict = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    console.log(districtId);
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `UPDATE district
                                SET district_name = '${districtName}',
                                    state_id = ${stateId},
                                    cases = ${cases},
                                    cured = ${cured},
                                    active = ${active},
                                    deaths = ${deaths}
                                WHERE district_id = ${districtId};`;
    const updateDistrict = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const statisticsQuery = `SELECT SUM(cases) as totalCases,
                                    SUM(cured) as totalCured,
                                    SUM(active) as totalActive,
                                    SUM(deaths) as totalDeaths
                            FROM (district Inner Join state
                            on district.state_id = state.state_id) as d
                             WHERE d.state_id = ${stateId};`;
    const statistics = await db.get(statisticsQuery);

    response.send(statistics);
  }
);

module.exports = app;
