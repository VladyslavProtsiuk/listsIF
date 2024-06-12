const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const process = require("process");
require("dotenv").config();
console.log(process.env.TOKEN);
const bot = new Telegraf(process.env.TOKEN);

const fs = require("fs").promises;
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

async function saveCredentials(client) {
	const content = await fs.readFile(CREDENTIALS_PATH);
	const keys = JSON.parse(content);
	const key = keys.installed || keys.web;
	const payload = JSON.stringify({
		type: "authorized_user",
		client_id: key.client_id,
		client_secret: key.client_secret,
		refresh_token: client.credentials.refresh_token,
	});
	await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
	let client = await loadSavedCredentialsIfExist();
	if (client) {
		return client;
	}
	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});
	if (client.credentials) {
		await saveCredentials(client);
	}
	return client;
}

async function copyFiles(authClient, number, linksArray, nameOfEvent) {
	const drive = google.drive({ version: "v3", auth: authClient });
	let folder = await drive.files.create({
		resource: {
			name: nameOfEvent,
			mimeType: "application/vnd.google-apps.folder",
			parents: [`1WStSQEvEU7cUKhFz-ZWideke8nCvS3x7`],
		},
		fields: "id",
	});
	console.log(folder);
	for (let i = 0; i < number; i++) {
		try {
			await drive.files.copy({
				fileId: linksArray[i],
				requestBody: {
					parents: [folder.data.id],
					name: `Copy_${i + 1}`,
				},
			});
		} catch (err) {
			console.error(`Error copying file ${linksArray[i]}:`, err);
		}
	}
}

bot.start((ctx) => {
	ctx.reply(
		"Привіт! \nЦе бот для відправки листів на перевірку. Напиши /help для подальшої інформації"
	);
});

bot.help((ctx) => {
	ctx.reply(
		"Ось список команд: \n/send_letters - Надіслати листи \n/send_example - Отримати приклад листа \n/send_req_example - Отримати приклад запиту на перевірку листів \nЩоб надіслати листи, надішли посилання на всі листи в одному повідомленні."
	);
});

bot.command("send_example", (ctx) => {
	ctx.reply(
		`Посилання на приклад: https://docs.google.com/document/d/14aKGxPAcu6k8Z5x0s6xG8VoqMU3CIQzc1FnhvhLs7hQ/edit?usp=sharing`
	);
});

bot.command("send_req_example", (ctx) => {
	ctx.reply(
		"Назва заходу\nhttps://docs.google.com/document/d/14aKGxPAcu6k8Z5x0s6xG8VoqMU3CIQzc1FnhvhLs7hQ/edit?usp=sharing"
	);
});

bot.on(message("text"), async (ctx) => {
	let text = ctx.update.message.text;
	let tarr = text.split("\n");
	let result = [];
	for (let i = 1; i < tarr.length; i++) {
		let id;
		if (tarr[i].indexOf("/edit") != -1) {
			id = tarr[i].slice(tarr[i].indexOf("d/") + 2, tarr[i].indexOf("/edit"));
		} else {
			id = tarr[i].slice(tarr[i].indexOf("d/") + 2);
		}

		result.push(id);
	}
	const authClient = await authorize();
	await copyFiles(authClient, result.length, result, tarr[0]);
	await ctx.reply(`Файли передано \nЗгодом буде відповідь!`);
});

bot.launch();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
