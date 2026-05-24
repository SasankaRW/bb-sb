const DATABASE_URL = "https://bb-scoreboardnew-default-rtdb.asia-southeast1.firebasedatabase.app";

module.exports = async (req, res) => {
    const matchId = req.query.match === "match2" ? "match2" : "match1";
    const firebaseUrl = `${DATABASE_URL}/matches/${matchId}/liveScoreboard.json`;

    try {
        const response = await fetch(firebaseUrl, {
            headers: { Accept: "application/json" },
            cache: "no-store"
        });
        const body = await response.text();

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(response.status).send(body || "null");
    } catch (error) {
        console.error("scoreboardState proxy failed", error);
        res.status(502).json({ error: "Unable to load scoreboard state." });
    }
};
