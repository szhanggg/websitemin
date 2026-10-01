const SUPABASE_URL = "https://eoysisqtidujhwqfrwxz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ynes80cnAL21U0a1AwSeKg_aIi12hSs";

async function rpc(name, parameters) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/${name}`,
        {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(parameters)
        }
    );

    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }

    return response.json();
}

function getVoterId() {
    let id = localStorage.getItem("poll-voter-id");

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("poll-voter-id", id);
    }

    return id;
}

for (const form of document.querySelectorAll("form[data-poll]")) {
    const questionId = form.dataset.poll;
    const votedKey = `poll-voted:${questionId}`;
    const answerKey = `poll-answer:${questionId}`;
    const fieldset = form.querySelector("fieldset");
    const status = form.querySelector(".status");
    const results = form.querySelector(".results");
    const options = Array.from(form.querySelectorAll('input[name="answer"]'), input => ({
        value: input.value,
        label: input.closest("label").textContent.trim()
    }));
    let voted = false;
    let votedAnswer = null;
    let submitting = false;

    async function showResults() {
        form.querySelector(".poll-options")?.remove();
        form.querySelector('button[type="submit"]')?.remove();
        fieldset.disabled = false;
        status.textContent = "";

        try {
            const rows = await rpc("poll_results", {
                p_question_id: questionId
            });

            const total = rows.reduce(
                (sum, row) => sum + Number(row.votes), 0
            );

            const breakdown = document.createElement("div");

            for (const option of options) {
                const row = rows.find(
                    row => row.option_value === option.value
                );
                const count = Number(row?.votes ?? 0);
                const percent = total
                    ? Math.round(count / total * 100)
                    : 0;

                const item = document.createElement("div");
                const marker = option.value === votedAnswer ? " (you)" : "";
                item.textContent = `${option.label}: ${percent}%${marker}`;
                breakdown.append(item);
            }

            results.replaceChildren(breakdown);
        } catch (error) {
            console.error(error);

            const retry = document.createElement("button");
            retry.type = "button";
            retry.textContent = "retry results";
            retry.addEventListener("click", showResults);

            results.replaceChildren("Could not load results. ", retry);
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (voted || submitting) return;

        const answer = new FormData(form).get("answer");
        if (!answer) return;

        submitting = true;
        fieldset.disabled = true;
        status.textContent = "";

        try {
            const inserted = await rpc("cast_poll_vote", {
                p_question_id: questionId,
                p_voter_id: getVoterId(),
                p_answer: answer
            });

            voted = true;
            if (inserted === true) votedAnswer = answer;

            // A storage failure here must not undo a successful vote.
            try {
                localStorage.setItem(votedKey, "true");
                if (votedAnswer !== null) {
                    localStorage.setItem(answerKey, votedAnswer);
                }
            } catch {}

            await showResults();
        } catch (error) {
            console.error(error);
            status.textContent =
                "Could not save your vote. Please try again.";
        } finally {
            submitting = false;
            fieldset.disabled = false;
        }
    });

    try {
        getVoterId();
        voted = localStorage.getItem(votedKey) === "true";
        votedAnswer = localStorage.getItem(answerKey);

        if (voted) {
            fieldset.disabled = true;
            await showResults();
        }
    } catch {
        fieldset.disabled = true;
        status.textContent = "Enable browser storage to vote.";
    }
}
