import type { ProviderModule } from "./module";
import abacus from "./abacus";
import aiand from "./aiand";
import alibaba from "./alibaba";
import alibabatokenplan from "./alibabatokenplan";
import amp from "./amp";
import antigravity from "./antigravity";
import atlascloud from "./atlascloud";
import augment from "./augment";
import azureopenai from "./azureopenai";
import bedrock from "./bedrock";
import bifrost from "./bifrost";
import chutes from "./chutes";
import claude from "./claude";
import clawrouter from "./clawrouter";
import clinepass from "./clinepass";
import codebuff from "./codebuff";
import coderabbit from "./coderabbit";
import codex from "./codex";
import commandcode from "./commandcode";
import copilot from "./copilot";
import cursor from "./cursor";
import deepgram from "./deepgram";
import deepinfra from "./deepinfra";
import deepseek from "./deepseek";
import devin from "./devin";
import devpass from "./devpass";
import doubao from "./doubao";
import elevenlabs from "./elevenlabs";
import factory from "./factory";
import fireworks from "./fireworks";
import gemini from "./gemini";
import gitkraken from "./gitkraken";
import grok from "./grok";
import groq from "./groq";
import helmcode from "./helmcode";
import huggingface from "./huggingface";
import hyper from "./hyper";
import ibmbob from "./ibmbob";
import jetbrains from "./jetbrains";
import kilo from "./kilo";
import kimi from "./kimi";
import kiro from "./kiro";
import litellm from "./litellm";
import llmman from "./llmman";
import llmproxy from "./llmproxy";
import longcat from "./longcat";
import manus from "./manus";
import mimo from "./mimo";
import minimax from "./minimax";
import mistral from "./mistral";
import moonshot from "./moonshot";
import muse from "./muse";
import neuralwatt from "./neuralwatt";
import notion from "./notion";
import nous from "./nous";
import ollama from "./ollama";
import openai from "./openai";
import opencode from "./opencode";
import opencodego from "./opencodego";
import openrouter from "./openrouter";
import perplexity from "./perplexity";
import pi from "./pi";
import poe from "./poe";
import qoder from "./qoder";
import qwencloud from "./qwencloud";
import replicate from "./replicate";
import sakana from "./sakana";
import stepfun from "./stepfun";
import sub2api from "./sub2api";
import synthetic from "./synthetic";
import t3chat from "./t3chat";
import typesafe from "./typesafe";
import v0 from "./v0";
import venice from "./venice";
import vercel from "./vercel";
import vertexai from "./vertexai";
import warp from "./warp";
import wayfinder from "./wayfinder";
import windsurf from "./windsurf";
import xai from "./xai";
import zai from "./zai";
import zed from "./zed";
import zenmux from "./zenmux";
import zoommate from "./zoommate";

export const PROVIDER_MODULES = {
  abacus,
  aiand,
  alibaba,
  alibabatokenplan,
  amp,
  antigravity,
  atlascloud,
  augment,
  azureopenai,
  bedrock,
  bifrost,
  chutes,
  claude,
  clawrouter,
  clinepass,
  codebuff,
  coderabbit,
  codex,
  commandcode,
  copilot,
  cursor,
  deepgram,
  deepinfra,
  deepseek,
  devin,
  devpass,
  doubao,
  elevenlabs,
  factory,
  fireworks,
  gemini,
  gitkraken,
  grok,
  groq,
  helmcode,
  huggingface,
  hyper,
  ibmbob,
  jetbrains,
  kilo,
  kimi,
  kiro,
  litellm,
  llmman,
  llmproxy,
  longcat,
  manus,
  mimo,
  minimax,
  mistral,
  moonshot,
  muse,
  neuralwatt,
  notion,
  nous,
  ollama,
  openai,
  opencode,
  opencodego,
  openrouter,
  perplexity,
  pi,
  poe,
  qoder,
  qwencloud,
  replicate,
  sakana,
  stepfun,
  sub2api,
  synthetic,
  t3chat,
  typesafe,
  v0,
  venice,
  vercel,
  vertexai,
  warp,
  wayfinder,
  windsurf,
  xai,
  zai,
  zed,
  zenmux,
  zoommate,
} satisfies Record<string, ProviderModule>;
