import type { ProviderModule } from "./module";
import abacus from "./abacus";
import aiand from "./aiand";
import atlascloud from "./atlascloud";
import azureopenai from "./azureopenai";
import bedrock from "./bedrock";
import bifrost from "./bifrost";
import chutes from "./chutes";
import clawrouter from "./clawrouter";
import clinepass from "./clinepass";
import codebuff from "./codebuff";
import coderabbit from "./coderabbit";
import deepgram from "./deepgram";
import deepinfra from "./deepinfra";
import deepseek from "./deepseek";
import devin from "./devin";
import devpass from "./devpass";
import elevenlabs from "./elevenlabs";
import fireworks from "./fireworks";
import gitkraken from "./gitkraken";
import groq from "./groq";
import huggingface from "./huggingface";
import hyper from "./hyper";
import ibmbob from "./ibmbob";
import litellm from "./litellm";
import llmman from "./llmman";
import llmproxy from "./llmproxy";
import longcat from "./longcat";
import manus from "./manus";
import moonshot from "./moonshot";
import muse from "./muse";
import neuralwatt from "./neuralwatt";
import nous from "./nous";
import openai from "./openai";
import pi from "./pi";
import poe from "./poe";
import qoder from "./qoder";
import replicate from "./replicate";
import sakana from "./sakana";
import t3chat from "./t3chat";
import typesafe from "./typesafe";
import v0 from "./v0";
import venice from "./venice";
import vercel from "./vercel";
import wayfinder from "./wayfinder";
import windsurf from "./windsurf";
import xai from "./xai";
import zed from "./zed";
import zenmux from "./zenmux";
import zoommate from "./zoommate";

export const PROVIDER_MODULES = {
  abacus,
  aiand,
  atlascloud,
  azureopenai,
  bedrock,
  bifrost,
  chutes,
  clawrouter,
  clinepass,
  codebuff,
  coderabbit,
  deepgram,
  deepinfra,
  deepseek,
  devin,
  devpass,
  elevenlabs,
  fireworks,
  gitkraken,
  groq,
  huggingface,
  hyper,
  ibmbob,
  litellm,
  llmman,
  llmproxy,
  longcat,
  manus,
  moonshot,
  muse,
  neuralwatt,
  nous,
  openai,
  pi,
  poe,
  qoder,
  replicate,
  sakana,
  t3chat,
  typesafe,
  v0,
  venice,
  vercel,
  wayfinder,
  windsurf,
  xai,
  zed,
  zenmux,
  zoommate,
} satisfies Record<string, ProviderModule>;
