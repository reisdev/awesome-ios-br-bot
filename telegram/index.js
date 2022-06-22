import dotenv from "dotenv";
import fetch from "node-fetch";
import { Telegraf, Scenes, session } from "telegraf";

let config = dotenv.config().parsed;

const bot = new Telegraf(config["API_TOKEN"]);

const shortcutRegex = /\-\s?\[(?<title>.+)\]\((?<link>.+)\)/g;

class Shortcut {
  constructor(title, link) {
    this.title = title;
    this.link = link;
  }
}

function checkIfIsUrl(string) {
  const match = shortcutRegex.exec(string);
  shortcutRegex.lastIndex = 0;
  try {
    new URL(match.groups["link"]);
    return true;
  } catch (error) {
    return false;
  }
}

function parseIntoShortcut(string) {
  const match = shortcutRegex.exec(string);
  shortcutRegex.lastIndex = 0;
  return new Shortcut(match.groups["title"], match.groups["link"]);
}

function extractShortcuts(list) {
  return list.filter(checkIfIsUrl).map(parseIntoShortcut);
}

let searchScene = new Scenes.BaseScene("busca");

searchScene.enter((ctx) =>
  ctx.reply("Olá. O que você deseja que eu procure na lista?")
);

searchScene.on("message", searchCommand);

const stage = new Scenes.Stage([searchScene]);

bot.use(session());
bot.use(stage.middleware());

async function searchCommand(ctx) {
  const terms = ctx.message.text.split(" ");

  if (terms.length == 0) {
    ctx.reply(
      "Você não digitou nada. Eu preciso saber o que você está procurando para te ajudar 😉"
    );
  }

  const search = terms.join(" ");

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/CodandoApple/aprenda-swift/main/README.md"
    );

    const text = await response.text();

    let shortcuts = extractShortcuts(text.match(shortcutRegex));

    let scores = shortcuts.map((shortcut) => {
      let title = shortcut.title.toLowerCase();

      let score = search.split(" ").reduce((sum, current) => {
        let contains = title.includes(current.toLowerCase());
        return contains ? sum + 1 : sum;
      }, 0);

      return score / title.split().length;
    });

    const results = shortcuts
      .filter((a) => scores[shortcuts.indexOf(a)] > 0)
      .sort((a, b) =>
        scores[shortcuts.indexOf(a)] > scores[shortcuts.indexOf(b)] ? -1 : 1
      )
      .slice(0, 3);

    let joined = results
      .map((shortcut) => `- <a href="${shortcut.link}">${shortcut.title}</a>\n`)
      .join("\n");

    let answerString = `Aqui estão os melhores resultados para <b>${search}</b>: \n\n${joined}`;

    await ctx.replyWithHTML(answerString, {
      disable_web_page_preview: true,
    });

    ctx.scene.leave();
  } catch (error) {
    console.error(error);
    ctx.reply(
      "Desculpa, tive um problema com a busca. Tente novamente daqui a pouco!"
    );
  }
}

bot.command("busca", (ctx) => {
  ctx.scene.enter("busca");
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
