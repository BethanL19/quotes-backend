import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Client } from "pg";
import { getEnvVarOrFail } from "./support/envVarUtils";

dotenv.config(); //Read .env file lines as though they were env vars.

const client = new Client({ connectionString: process.env.DATABASE_URL });
if (process.env.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is undefined!");
}

//Configure express routes
const app = express();

app.use(express.json()); //add JSON body parser to each following route handler
app.use(cors()); //add CORS support to each following route handler

// get a random quote
app.get("/quotes/1", async (req, res) => {
    try {
        const CountAll = "SELECT COUNT(*) from mot_quotes";
        const total = await client.query(CountAll);
        const random_id = Math.floor(
            Math.random() * parseInt(total.rows[0].count)
        );
        const queryForRandom =
            "Select q.id, q.quote, q.author, case when f.quote_id is not null then 'true' else 'false' end as in_favourites from mot_quotes q left join favourite_quotes f on q.id = f.quote_id where q.id = $1";
        const random = await client.query(queryForRandom, [random_id]);
        res.status(200).json(random.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// get random 5 quotes
app.get("/quotes/5", async (req, res) => {
    try {
        const CountAll = "SELECT COUNT(*) from mot_quotes";
        const total = await client.query(CountAll);
        const random_idList = () => {
            const arrOfIds = [];
            for (let i = 0; i < 5; i++) {
                arrOfIds.push(
                    Math.floor(Math.random() * parseInt(total.rows[0].count))
                );
            }
            return arrOfIds;
        };
        const queryForRandom =
            "Select q.id, q.quote, q.author, case when f.quote_id is not null then 'true' else 'false' end as in_favourites from mot_quotes q left join favourite_quotes f on q.id = f.quote_id where q.id in ($1, $2, $3, $4, $5)";
        const random = await client.query(queryForRandom, random_idList());
        res.status(200).json(random.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// get all favourite quotes
app.get("/quotes/favourites", async (req, res) => {
    try {
        const all = "SELECT * from favourite_quotes";
        const allItems = await client.query(all);
        res.status(200).json(allItems.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// add quote to favourites
app.post<{}, {}, { id: string }>("/quotes/favourites", async (req, res) => {
    try {
        const find = await client.query(
            "select * from mot_quotes where id = $1",
            [parseInt(req.body.id)]
        );
        const insert =
            "insert into favourite_quotes (quote_id, quote, author) values ($1, $2, $3)";
        const insertValues = [
            find.rows[0].id,
            find.rows[0].quote,
            find.rows[0].author,
        ];
        const add = await client.query(insert, insertValues);

        res.json("Quote favourited");
    } catch (err) {
        console.error(err);
        res.status(500).send(
            "Something went wrong or quote has already been favourited!"
        );
    }
});

// remove quote from favourites
app.delete("/quotes/favourites/:id", async (req, res) => {
    try {
        const del = "delete from favourite_quotes where quote_id = $1";
        const delValue = [parseInt(req.params.id)];
        const unFav = await client.query(del, delValue);
        res.json("Quote unfavourited");
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// add quote to db (doesn't igore duplicates)
app.post<{}, {}, { quote: string; author: string }>(
    "/quotes",
    async (req, res) => {
        try {
            const insert =
                "insert into mot_quotes (quote, author) values ($1, $2)";
            const insertValues = [req.body.quote, req.body.author];
            const add = await client.query(insert, insertValues);
            res.json("Quote added");
        } catch (err) {
            console.error(err);
            res.status(500).send("Something went wrong");
        }
    }
);

app.get("/health-check", async (req, res) => {
    try {
        //For this to be successful, must connect to db
        await client.query("select now()");
        res.status(200).send("system ok");
    } catch (error) {
        //Recover from error rather than letting system halt
        console.error(error);
        res.status(500).send("An error occurred. Check server logs.");
    }
});

connectToDBAndStartListening();

async function connectToDBAndStartListening() {
    console.log("Attempting to connect to db");
    await client.connect();
    console.log("Connected to db!");

    const port = getEnvVarOrFail("PORT");
    app.listen(port, () => {
        console.log(
            `Server started listening for HTTP requests on port ${port}.  Let's go!`
        );
    });
}
