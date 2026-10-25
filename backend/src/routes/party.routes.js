import express from "express";

import {
  partyChat
} from "../controller/party.controller.js";


const router =
  express.Router();


router.post(
  "/chat",
  partyChat
);


export default router