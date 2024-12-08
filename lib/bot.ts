import { Bot, Context } from "https://deno.land/x/grammy@v1.32.0/mod.ts";
import { menuKeyboard, yesOrNo } from "./keyboards.ts"; // импорт клавиатур
import { getProfile, reviewProfile, setState } from "./functions.ts"; //импорт функций
import { createClient } from "npm:@supabase/supabase-js"; // database
import { UserInfo } from "./interfaces.ts";

// инициализация supabase
const supabaseUrl = "https://skabfydkbgdodqxttswh.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYWJmeWRrYmdkb2RxeHR0c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2NTI1NTcsImV4cCI6MjA0OTIyODU1N30.3z11DEmN-Dmxcj5xBzOBMZagRJfodRPfbetGoxvJNMc";
const supabase = createClient(supabaseUrl, supabaseKey);
export const users = supabase.from("users");

//объявил бота
export const bot = new Bot<Context>(Deno.env.get("BOT_TOKEN") || "7556907097:AAFerRjuaou1JjXBVaRwp4b5sKq_EAo9vRM");

// локальная информация о пользователе
export const info: UserInfo = {
  id: 0,
  name: "",
  age: 0,
  interests: [],
  lat: 0,
  long: 0,
  time: "",
  state: "",
  rating: 0,
  done: false,
};

// info будет нужна для сохранения инфо пользователя в бд (или получения) - представляет из себя набор данных о пользователе
bot.command("start", async (ctx) => { // бот получает команду /start
  info.id = Number(ctx.msg.from?.id);
  if (await getProfile()) {
    await ctx.reply(`Здравствуйте, ${info.name}!`, { reply_markup: menuKeyboard });
  } else {
    await users.insert({
      tg_id: info.id,
      state: "setName",
    });
    await ctx.reply(
      "Здравствуйте!Я ваш личный помощник по встречам в городе.!",
    );
    await ctx.reply(
      "Представьтесь,пожалуйста </b>",
      { parse_mode: "HTML" }, // нужно, чтобы использовать теги из html
    );
    setState("setName"); // следующим сообщением боту должно придти имя
  }
});

// обработка подтверждения интересов
bot.callbackQuery("interestsDone", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply("Супер!");
  await reviewProfile(ctx);
});
bot.callbackQuery("interestsNotDone", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply("Добавьте увлечений");
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
            "Имя должно быть текстом.",
          );
          return;
        } else {
          info.name = ctx.msg.text || ""; //сохраняем в переменную
          await ctx.reply("Приятно познакомиться, " + info.name + "!");
          await ctx.reply("Сколько вам лет?");
          setState("setAge");
        }
        break;

      case "setAge":
        if (isNaN(Number(ctx.msg.text))) {
          await ctx.reply("Извините,введите возраст числом!");
          return;
        }
        info.age = Number(ctx.msg.text);
        await ctx.reply(
          "Отправьте мне местоположение, где хотели бы назначить встречу",
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
            await ctx.reply("Отлично!");
            await users.update({
              name: info.name,
              age: info.age,
              // geo: info.geo,
              time: info.time,
              interests: info.interests,
              done: info.done,
            }).eq("tg_id", info.id).single();
            break;

          case "Нет, хочу изменить":
            setState("setName");
            await ctx.reply("Давайте начнем сначала! Как вас зовут?");
            info.interests = [];
            break;

          default:
            await ctx.reply("Выберите один из вариантов");
            break;
        }
        break;
      // case "changeProfile":
      //   switch (ctx.msg.text) {
      //     case "Хочу заполнить профиль заново":
      //       await ctx.reply("Хорошо, введи другое имя");
      //       setState("setName");
      //       break;
      //     default:
      //       await ctx.reply(
      //         "Выбери вариант ответа, используя клавиатуру Telegram!",
      //       );
      //       break;
      //   }
      //   break;
      case "setGeo":
        if (!ctx.msg.location) {
          await ctx.reply(
            "Пожалуйста, отправьте мне местоположение",
          );
          return;
        }
        info.lat = ctx.msg.location?.latitude;
        info.long = ctx.msg.location?.longitude; // записываем геопозицию в виде: ширина, долгота
        await ctx.reply(
          "Расскажите мне о своих хобби!",
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
          "Ваши интересы:",
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

// while (info.state == "searching") {
// }
