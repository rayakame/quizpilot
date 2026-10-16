import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import type { QuestionResult, QuizEnd } from "../../core/kahoot/normalize.js"
import type { Cost } from "../../core/cost/prices.js"
import type { Decision } from "../../core/types.js"
import type {
  HistoryBot,
  HistoryGame,
  HistoryQuestion,
  HistoryRecord,
  NewGame,
  QuestionView,
  Timing,
} from "../../shared/api.js"

const SCHEMA = `
create table games (
  id integer primary key,
  pin text not null,
  quiz_title text,
  quiz_id text,
  quiz_link text,
  context text,
  timing text not null,
  include_previous integer not null,
  started_at integer not null,
  ended_at integer
);
create table bots (
  game_id integer not null references games(id) on delete cascade,
  name text not null,
  status text,
  total_score integer,
  rank integer,
  primary key (game_id, name)
);
create table questions (
  game_id integer not null references games(id) on delete cascade,
  idx integer not null,
  type text not null,
  title text,
  choices text not null,
  image text,
  image_alt text,
  image_path text,
  time_limit_ms integer not null,
  slider text,
  correct text,
  primary key (game_id, idx)
);
create table decisions (
  game_id integer not null,
  idx integer not null,
  answer text not null,
  source text not null,
  confidence real,
  jev text,
  fallback text,
  usage text not null,
  cost_usd real not null,
  cost_complete integer not null,
  primary key (game_id, idx),
  foreign key (game_id, idx) references questions(game_id, idx) on delete cascade
);
create table results (
  game_id integer not null,
  idx integer not null,
  bot text not null,
  answered_ms integer,
  correct integer,
  points integer,
  total_score integer,
  rank integer,
  primary key (game_id, idx, bot),
  foreign key (game_id, idx) references questions(game_id, idx) on delete cascade
);
`

const GAMES = `
select g.id, g.pin, g.quiz_title, g.quiz_link, g.context, g.timing, g.include_previous,
  g.started_at, g.ended_at,
  (select count(*) from questions q where q.game_id = g.id and q.type <> 'content') as questions,
  (select count(*) from questions q where q.game_id = g.id and exists (
    select 1 from results r where r.game_id = q.game_id and r.idx = q.idx and r.correct is not null
  )) as graded,
  (select count(*) from questions q where q.game_id = g.id and exists (
    select 1 from results r where r.game_id = q.game_id and r.idx = q.idx and r.correct is not null
  ) and not exists (
    select 1 from results r where r.game_id = q.game_id and r.idx = q.idx and r.correct = 0
  )) as correct,
  (select coalesce(sum(d.cost_usd), 0) from decisions d where d.game_id = g.id) as cost_usd,
  (select coalesce(min(d.cost_complete), 1) from decisions d where d.game_id = g.id) as cost_complete
from games g`

type Row = Record<string, SQLInputValue>

export class HistoryStore {
  private constructor(private readonly db: DatabaseSync) {}

  static open(file: string): HistoryStore {
    const db = new DatabaseSync(file)
    db.exec("pragma foreign_keys = on")
    const { user_version } = db.prepare("pragma user_version").get() as { user_version: number }
    if (user_version === 0) {
      db.exec(`begin; ${SCHEMA}; pragma user_version = 1; commit;`)
    }
    return new HistoryStore(db)
  }

  close(): void {
    this.db.close()
  }

  startGame(g: NewGame): number {
    const { lastInsertRowid } = this.db
      .prepare(
        `insert into games (pin, quiz_title, quiz_id, quiz_link, context, timing, include_previous, started_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        g.pin,
        g.quizTitle,
        g.quizId,
        g.quizLink,
        g.context,
        JSON.stringify(g.timing),
        g.includePrevious ? 1 : 0,
        g.startedAt,
      )
    return Number(lastInsertRowid)
  }

  endGame(id: number, at: number): void {
    this.db.prepare("update games set ended_at = coalesce(ended_at, ?) where id = ?").run(at, id)
  }

  saveBot(id: number, name: string, status: string | null): void {
    this.db
      .prepare(
        "insert into bots (game_id, name, status) values (?, ?, ?) on conflict (game_id, name) do update set status = excluded.status",
      )
      .run(id, name, status)
  }

  endBot(id: number, name: string, end: QuizEnd): void {
    this.db
      .prepare(
        "insert into bots (game_id, name, total_score, rank) values (?, ?, ?, ?) on conflict (game_id, name) do update set total_score = excluded.total_score, rank = excluded.rank",
      )
      .run(id, name, end.totalScore, end.rank)
  }

  saveQuestion(id: number, q: QuestionView): void {
    this.db
      .prepare(
        `insert into questions (game_id, idx, type, title, choices, image, image_alt, time_limit_ms, slider)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (game_id, idx) do update set type = excluded.type, title = excluded.title,
           choices = excluded.choices, image = excluded.image, image_alt = excluded.image_alt,
           time_limit_ms = excluded.time_limit_ms, slider = excluded.slider`,
      )
      .run(
        id,
        q.index,
        q.type,
        q.title,
        JSON.stringify(q.choices),
        q.image?.url ?? null,
        q.imageAlt ?? null,
        q.timeLimitMs,
        q.slider ? JSON.stringify(q.slider) : null,
      )
  }

  setImagePath(id: number, idx: number, path: string): void {
    this.db
      .prepare("update questions set image_path = ? where game_id = ? and idx = ?")
      .run(path, id, idx)
  }

  saveDecision(id: number, idx: number, d: Decision, cost: Cost): void {
    this.db
      .prepare(
        `insert or replace into decisions
         (game_id, idx, answer, source, confidence, jev, fallback, usage, cost_usd, cost_complete)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        idx,
        JSON.stringify(d.answer),
        d.source,
        d.confidence,
        d.jev ? JSON.stringify(d.jev) : null,
        d.fallback ? JSON.stringify(d.fallback) : null,
        JSON.stringify(d.usage),
        cost.usd,
        cost.complete ? 1 : 0,
      )
  }

  saveAnswered(id: number, idx: number, bot: string, ms: number): void {
    this.db
      .prepare(
        "insert into results (game_id, idx, bot, answered_ms) values (?, ?, ?, ?) on conflict (game_id, idx, bot) do update set answered_ms = excluded.answered_ms",
      )
      .run(id, idx, bot, Math.round(ms))
  }

  saveResult(id: number, idx: number, bot: string, r: QuestionResult): void {
    this.db
      .prepare(
        `insert into results (game_id, idx, bot, correct, points, total_score, rank) values (?, ?, ?, ?, ?, ?, ?)
         on conflict (game_id, idx, bot) do update set correct = excluded.correct, points = excluded.points,
           total_score = excluded.total_score, rank = excluded.rank`,
      )
      .run(
        id,
        idx,
        bot,
        r.correct === null ? null : r.correct ? 1 : 0,
        r.points,
        r.totalScore,
        r.rank,
      )
    if (r.correctChoices) {
      this.db
        .prepare("update questions set correct = ? where game_id = ? and idx = ?")
        .run(JSON.stringify(r.correctChoices), id, idx)
    }
  }

  listGames(): HistoryGame[] {
    return this.db
      .prepare(`${GAMES} order by g.started_at desc, g.id desc`)
      .all()
      .map((row) => toGame(row as Row))
  }

  latestGameId(): number | null {
    const row = this.db
      .prepare("select id from games order by started_at desc, id desc limit 1")
      .get()
    return row ? Number((row as Row).id) : null
  }

  getGame(id: number): HistoryRecord | null {
    const row = this.db.prepare(`${GAMES} where g.id = ?`).get(id) as Row | undefined
    if (!row) return null
    const bots = this.db
      .prepare("select name, status, total_score, rank from bots where game_id = ? order by rowid")
      .all(id)
      .map((b) => toBot(b as Row))
    const decisions = new Map(
      this.db
        .prepare("select * from decisions where game_id = ?")
        .all(id)
        .map((d) => [Number((d as Row).idx), d as Row]),
    )
    const results = this.db
      .prepare("select * from results where game_id = ? order by rowid")
      .all(id) as Row[]
    const questions = this.db
      .prepare("select * from questions where game_id = ? order by idx")
      .all(id)
      .map((q) => toQuestion(q as Row, decisions.get(Number((q as Row).idx)), results))
    return {
      game: {
        ...toGame(row),
        context: text(row.context),
        quizLink: text(row.quiz_link),
        timing: JSON.parse(String(row.timing)) as Timing,
        includePrevious: Number(row.include_previous) === 1,
      },
      bots,
      questions,
    }
  }

  deleteGame(id: number): boolean {
    return this.db.prepare("delete from games where id = ?").run(id).changes > 0
  }

  deleteAll(): number[] {
    const ids = this.db
      .prepare("select id from games")
      .all()
      .map((r) => Number((r as Row).id))
    this.db.exec("delete from games")
    return ids
  }
}

function toGame(row: Row): HistoryGame {
  return {
    id: Number(row.id),
    pin: String(row.pin),
    quizTitle: text(row.quiz_title),
    startedAt: Number(row.started_at),
    endedAt: int(row.ended_at),
    questions: Number(row.questions),
    graded: Number(row.graded),
    correct: Number(row.correct),
    costUsd: Number(row.cost_usd),
    costComplete: Number(row.cost_complete) === 1,
  }
}

function toBot(row: Row): HistoryBot {
  return {
    name: String(row.name),
    status: text(row.status),
    totalScore: int(row.total_score),
    rank: int(row.rank),
  }
}

function toQuestion(row: Row, d: Row | undefined, results: Row[]): HistoryQuestion {
  const idx = Number(row.idx)
  const image = text(row.image)
  const slider = text(row.slider)
  return {
    question: {
      index: idx,
      type: String(row.type) as QuestionView["type"],
      title: text(row.title),
      choices: JSON.parse(String(row.choices)) as QuestionView["choices"],
      image: image ? { url: image } : null,
      imageAlt: text(row.image_alt),
      timeLimitMs: Number(row.time_limit_ms),
      ...(slider ? { slider: JSON.parse(slider) as NonNullable<QuestionView["slider"]> } : {}),
    },
    imagePath: text(row.image_path),
    correctChoices: row.correct ? (JSON.parse(String(row.correct)) as number[]) : null,
    decision: d ? toDecision(d) : null,
    costUsd: d ? Number(d.cost_usd) : null,
    results: results
      .filter((r) => Number(r.idx) === idx)
      .map((r) => ({
        bot: String(r.bot),
        answeredMs: int(r.answered_ms),
        correct: r.correct === null ? null : Number(r.correct) === 1,
        points: int(r.points),
      })),
  }
}

function toDecision(d: Row): Decision {
  return {
    answer: JSON.parse(String(d.answer)) as Decision["answer"],
    source: String(d.source) as Decision["source"],
    confidence: d.confidence === null ? null : Number(d.confidence),
    ...(d.jev ? { jev: JSON.parse(String(d.jev)) as NonNullable<Decision["jev"]> } : {}),
    ...(d.fallback
      ? { fallback: JSON.parse(String(d.fallback)) as NonNullable<Decision["fallback"]> }
      : {}),
    usage: JSON.parse(String(d.usage)) as Decision["usage"],
  }
}

function text(v: SQLInputValue | undefined): string | null {
  return v === null || v === undefined ? null : String(v)
}

function int(v: SQLInputValue | undefined): number | null {
  return v === null || v === undefined ? null : Number(v)
}
