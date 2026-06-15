import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'stories.json');

const MAX_PARTICIPANTS = 10;
const MAX_CHARS_PER_STORY = 5000;

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { stories: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { stories: {} };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calcStoryTotalChars(entries) {
  return entries.reduce((sum, e) => sum + (e.content?.length || 0), 0);
}

function computeStoryStatus(entries) {
  const totalChars = calcStoryTotalChars(entries || []);
  const participantCount = new Set((entries || []).map(e => e.author)).size;
  const locked = totalChars >= MAX_CHARS_PER_STORY || participantCount >= MAX_PARTICIPANTS;
  const lockedReason = totalChars >= MAX_CHARS_PER_STORY
    ? `已达到字数上限（${totalChars}/${MAX_CHARS_PER_STORY}字）`
    : participantCount >= MAX_PARTICIPANTS
      ? `已达到接龙人数上限（${participantCount}/${MAX_PARTICIPANTS}人）`
      : null;
  return { totalChars, participantCount, locked, lockedReason };
}

function updateStoryStatus(story) {
  const status = computeStoryStatus(story.entries);
  story.totalChars = status.totalChars;
  story.participantCount = status.participantCount;
  story.locked = status.locked;
  story.lockedReason = status.lockedReason;
}

function formatStoryDetail(story) {
  const status = computeStoryStatus(story.entries);
  const entries = (story.entries || []).map((e, idx) => ({ ...e, order: idx + 1 }));
  return {
    id: story.id,
    title: story.title,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    entryCount: entries.length,
    participantCount: status.participantCount,
    totalChars: status.totalChars,
    maxChars: MAX_CHARS_PER_STORY,
    maxParticipants: MAX_PARTICIPANTS,
    locked: status.locked,
    lockedReason: status.lockedReason,
    entries
  };
}

export function createStory({ title, content, author }) {
  const data = readData();
  const id = generateId();
  const now = Date.now();
  const story = {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    entries: [{
      id: generateId(),
      author,
      content,
      order: 1,
      createdAt: now
    }]
  };
  updateStoryStatus(story);
  data.stories[id] = story;
  writeData(data);
  return formatStoryDetail(story);
}

export function getAllStories() {
  const data = readData();
  return Object.values(data.stories)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(s => {
      const status = computeStoryStatus(s.entries);
      return {
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        entryCount: (s.entries || []).length,
        participantCount: status.participantCount,
        totalChars: status.totalChars,
        locked: status.locked,
        lockedReason: status.lockedReason
      };
    });
}

export function getStoryById(id) {
  const data = readData();
  const story = data.stories[id];
  if (!story) return null;
  return formatStoryDetail(story);
}

export function addEntry(storyId, { content, author }) {
  const data = readData();
  const story = data.stories[storyId];
  if (!story) {
    return { success: false, error: '故事不存在', code: 404 };
  }
  const currentStatus = computeStoryStatus(story.entries);
  if (currentStatus.locked) {
    return { success: false, error: currentStatus.lockedReason || '故事已锁定', code: 409 };
  }
  const contentLen = content?.length || 0;
  if (contentLen === 0) {
    return { success: false, error: '续写内容不能为空', code: 400 };
  }
  if (currentStatus.totalChars + contentLen > MAX_CHARS_PER_STORY) {
    return {
      success: false,
      error: `内容过长，当前剩余可容纳 ${MAX_CHARS_PER_STORY - currentStatus.totalChars} 字`,
      code: 413
    };
  }
  const now = Date.now();
  story.entries.push({
    id: generateId(),
    author,
    content,
    order: story.entries.length + 1,
    createdAt: now
  });
  story.updatedAt = now;
  updateStoryStatus(story);
  writeData(data);
  return { success: true, story: formatStoryDetail(story) };
}

export function resetStory(storyId) {
  const data = readData();
  const story = data.stories[storyId];
  if (!story) {
    return { success: false, error: '故事不存在', code: 404 };
  }
  const firstEntry = story.entries[0];
  const now = Date.now();
  story.entries = firstEntry ? [{
    id: generateId(),
    author: firstEntry.author,
    content: firstEntry.content,
    order: 1,
    createdAt: now
  }] : [];
  story.createdAt = now;
  story.updatedAt = now;
  updateStoryStatus(story);
  writeData(data);
  return { success: true, story: formatStoryDetail(story) };
}

function diagnoseStory(story) {
  const issues = [];

  const entries = story.entries || [];

  let expectedOrder = 1;
  const orderIssues = [];
  entries.forEach((entry, idx) => {
    if (entry.order !== expectedOrder) {
      orderIssues.push({
        index: idx,
        entryId: entry.id,
        expected: expectedOrder,
        actual: entry.order
      });
    }
    expectedOrder++;
  });
  if (orderIssues.length > 0) {
    issues.push({
      type: 'order',
      name: '段落顺序',
      expected: `1-${entries.length}`,
      actual: '存在不连续或错位',
      details: orderIssues
    });
  }

  const actualChars = calcStoryTotalChars(entries);
  if (actualChars !== (story.totalChars || 0)) {
    issues.push({
      type: 'totalChars',
      name: '总字数',
      expected: actualChars,
      actual: story.totalChars || 0
    });
  }

  const actualParticipants = new Set(entries.map(e => e.author)).size;
  if (actualParticipants !== (story.participantCount || 0)) {
    issues.push({
      type: 'participantCount',
      name: '参与人数',
      expected: actualParticipants,
      actual: story.participantCount || 0
    });
  }

  return {
    storyId: story.id,
    title: story.title,
    entryCount: entries.length,
    hasIssues: issues.length > 0,
    issues
  };
}

export function diagnoseAllStories() {
  const data = readData();
  const results = Object.values(data.stories).map(s => diagnoseStory(s));
  const totalStories = results.length;
  const issueCount = results.filter(r => r.hasIssues).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  return {
    totalStories,
    issueCount,
    totalIssues,
    stories: results
  };
}

export function fixStory(storyId) {
  const data = readData();
  const story = data.stories[storyId];
  if (!story) {
    return { success: false, error: '故事不存在', code: 404 };
  }

  const entries = story.entries || [];
  entries.forEach((entry, idx) => {
    entry.order = idx + 1;
  });

  updateStoryStatus(story);
  writeData(data);

  const diagnosis = diagnoseStory(story);
  return {
    success: true,
    fixedIssues: true,
    story: formatStoryDetail(story),
    diagnosis
  };
}

export function fixAllStories() {
  const data = readData();
  let fixedCount = 0;
  const results = [];

  Object.values(data.stories).forEach(story => {
    const before = diagnoseStory(story);
    if (before.hasIssues) {
      const entries = story.entries || [];
      entries.forEach((entry, idx) => {
        entry.order = idx + 1;
      });
      updateStoryStatus(story);
      fixedCount++;
    }
    results.push({
      storyId: story.id,
      title: story.title,
      hadIssues: before.hasIssues
    });
  });

  if (fixedCount > 0) {
    writeData(data);
  }

  return {
    success: true,
    totalStories: Object.keys(data.stories).length,
    fixedCount
  };
}

export { MAX_PARTICIPANTS, MAX_CHARS_PER_STORY };
