import { Bot, Context} from "https://deno.land/x/grammy@v1.32.0/mod.ts";


import { reviewProfile, setState } from "./functions.ts"; //импорт функций
import { createClient } from "npm:@supabase/supabase-js"; // database
import { changesKeyboard, menuKeyboard, yesOrNo } from "./keyboards.ts"; // импорт клавиатур
import { UserInfo } from "./interfaces.ts";
// инициализация supabase
const supabaseUrl = "https://skabfydkbgdodqxttswh.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYWJmeWRrYmdkb2RxeHR0c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2NTI1NTcsImV4cCI6MjA0OTIyODU1N30.3z11DEmN-Dmxcj5xBzOBMZagRJfodRPfbetGoxvJNMc";
const supabase = createClient(supabaseUrl, supabaseKey );
export const users = supabase.from("users");
// Создайте экземпляр класса `Bot` и передайте ему токен вашего бота.
// Токен и адрес бэкенда мы спрячем, чтобы никто не смог воспользоваться нашим ботом или взломать нас. Получим их из файла .env (или из настроек в Deno Deploy)
export const bot = new Bot(Deno.env.get("BOT_TOKEN") || "8050336969:AAGkykRU9fhf1BU_ZbdUnYjkZONFHBkeuO8"); // export нужен, чтобы воспользоваться ботом в другом файле

export let info: UserInfo = {
  id: 0,
  name: "",
  age: 0,
  interests: [],
  geo: {
    latitude: 0,
    longtitude: 0,
  },
  time: "",
  state: "",
  rating: 0,
  done: false,
};

// info будет нужна для сохранения инфо пользователя в бд (или получения) - представляет из себя набор данных о пользователе
bot.command("start", async (ctx) => { // бот получает команду /start
  info.id = Number(ctx.msg.from?.id);
  if ((await users.select().eq("tg_id", ctx.msg.from?.id).single()).data) {
    info.name = (await users.select().eq("tg_id", info.id).single()).data.name;
    info.age = (await users.select().eq("tg_id", info.id).single()).data.age;
    info.interests =
      (await users.select().eq("tg_id", info.id).single()).data.interests;
    info.geo = (await users.select().eq("tg_id", info.id).single()).data.geo;
    info.time = (await users.select().eq("tg_id", info.id).single()).data.time;
    info.done = (await users.select().eq("tg_id", info.id).single()).data.done;
    await ctx.reply(`Привет, ${info.name}!`, { reply_markup: menuKeyboard });
  } else {
    await users.insert({
      tg_id: info.id,
      state: "setName",
    });
    await ctx.reply(
      "Привет!Я ваш личный помощник по встречам в городе.",
    );
    await ctx.reply(
      "Как вас зовут ? </b>",
      { parse_mode: "HTML" }, // нужно, чтобы использовать теги из html
    );
    setState("setName"); // следующим сообщением боту должно придти имя
  }
});

// обработка подтверждения интересов
bot.callbackQuery("interestsDone", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply("Хорошо!");
  await reviewProfile(ctx);
});
bot.callbackQuery("interestsNotDone", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply("Добавьте увлечений!");
  setState("setInterests");
});

bot.hears(
  ["профиль", "Профиль", "Мой профиль", "Мой профиль 👤"],
  async (ctx) => {
    await reviewProfile(ctx);
  },
);

bot.on("message", async (ctx) => {
  if (info.state) { // при непустом info.state
    switch (info.state) {
      case "setName":
        if (
          typeof ctx.msg.text !== "string" ||
          /[0-9_.*^%$#@!]/.test(ctx.msg.text) // регулярное выражение на проверку спец символов
        ) {
          await ctx.reply(
            "Имя искючительно текстом.",
          );
          return;
        } else {
          info.name = ctx.msg.text || ""; //сохраняем в переменную
          await ctx.reply("Приятно познакомиться, " + info.name + "!");
          await ctx.reply("Укажите свой возраст");
          setState("setAge");
        }
        break;

      case "setAge":
        if (isNaN(Number(ctx.msg.text))) {
          await ctx.reply("Введите возраст числом!");
          return;
        }
        info.age = Number(ctx.msg.text);
        await ctx.reply(
          "Отправьте мне местоположение, рядом с которым тебе будет удобно встретиться",
        );
        await ctx.reply(
          "Нажмите на скрепку🖇️ -> местоположение📍",
        );
        setState("setGeo");
        break;

      case "review":
        switch (ctx.msg.text) {
          case "Да!":
            info.done = true;
            await ctx.reply("Хорошо!");
            await users.update({
              name: info.name,
              age: info.age,
              geo: JSON.stringify(info.geo),
              time: info.time,
              interests: info.interests,
              done: info.done,
            }).eq("tg_id", info.id);
            break;

          case "Нет, хочу изменить":
            setState("changeProfile");
            await ctx.reply("Выберите интересующий параметр", {
              reply_markup: changesKeyboard,
            });
            break;

          default:
            await ctx.reply("Выберите один из вариантов!");
            break;
        }
        break;
      case "changeProfile":
        switch (ctx.msg.text) {
          case "Имя":
            await ctx.reply("Введите другое имя");
            break;
          case "Возраст":
            await ctx.reply("Введите другой возраст");
            break;
          case "Геопозицию":
            await ctx.reply("Введите другую геопозицию");
            break;
          case "Интересы":
            await ctx.reply("Введите другие интересы");
            break;
          case "Удобное время":
            await ctx.reply("Введите другое время");
            break;
          case "Хочу заполнить профиль заново":
            await ctx.reply("Введите другое имя");
            break;
          default:
            await ctx.reply(
              "Выберите вариант ответа",
            );
            break;
        }
        break;
      case "setGeo":
        if (!ctx.msg.location) {
          await ctx.reply(
            "Пожалуйста, отправьте местоположение",
          );
          return;
        }
        info.geo.latitude = ctx.msg.location?.latitude;
        info.geo.longitiute = ctx.msg.location?.longitude; // записываем геопозицию в виде: ширина, долгота
        await ctx.reply(
          "Перечислите через запятую свои хобби и увлечения",
        );
        setState("setInterests");
        break;

      case "setInterests":
        if (ctx.msg.text) {
          for (const interest of ctx.msg.text?.split(",")) {
            info.interests.push(interest.trim());
          }
        }
        await ctx.reply(
          "Список ваших интересов:",
        );
        await ctx.reply(
          info.interests.toString(),
        );
        await ctx.reply("Это все?", { reply_markup: yesOrNo }); // смотри bot.callbackQuery
        break;

      default:
        break;
    }
  }
});
