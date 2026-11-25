import knex from "knex";
import { knexConfig } from "./config.js";

/** The one Knex instance for the whole process. */
export const db = knex(knexConfig);
