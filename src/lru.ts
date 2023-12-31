/**
 * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
 * recently used items while discarding least recently used items when its limit
 * is reached.
 *
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * See README.md for details.
 *
 * Illustration of the design:
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 */

const NEWER = Symbol("newer");
const OLDER = Symbol("older");
// An entry holds the key and value, and pointers to any older and newer entries.
interface Entry<K, V> {
  key: K;
  value: V;
}

class LRUMap<K, V> {
  // Current number of items
  size: number;
  // Maximum number of items this map can hold
  limit: number;

  // Least recently-used entry. Invalidated when map is modified.
  oldest: Entry<K, V> | undefined;

  // Most recently-used entry. Invalidated when map is modified.
  newest: Entry<K, V> | undefined;

  destroyWhileDelete = true;

  private _keymap;
  // Construct a new cache object which will hold up to limit entries.
  // When the size == limit, a `put` operation will evict the oldest entry.
  //
  // If `entries` is provided, all entries are added to the new map.
  // `entries` should be an Array or other iterable object whose elements are
  // key-value pairs (2-element Arrays). Each key-value pair is added to the new Map.
  // null is treated as undefined.
  constructor(entries: Iterable<[K, V]>);
  constructor(limit: number, entries?: Iterable<[K, V]>);
  constructor(
    limit: number | Iterable<[K, V]>,
    entries?: Iterable<[K, V]>
    // destroyWhileDelete?: boolean
  ) {
    if (typeof limit !== "number") {
      // called as (entries)
      entries = limit;
      limit = 0;
    }

    this.size = 0;
    this.limit = limit;
    this.oldest = this.newest = undefined;
    this._keymap = new Map();

    // this.destroyWhileDelete = !!destroyWhileDelete;

    if (entries) {
      this.assign(entries);
      if (limit < 1) {
        this.limit = this.size;
      }
    }
  }

  _markEntryAsUsed(entry: Entry<K, V>) {
    if (entry === this.newest) {
      // Already the most recenlty used entry, so no need to update the list
      return;
    }
    // HEAD--------------TAIL
    //   <.older   .newer>
    //  <--- add direction --
    //   A  B  C  <D>  E
    if (entry[NEWER]) {
      if (entry === this.oldest) {
        this.oldest = entry[NEWER];
      }
      entry[NEWER][OLDER] = entry[OLDER]; // C <-- E.
    }
    if (entry[OLDER]) {
      entry[OLDER][NEWER] = entry[NEWER]; // C. --> E
    }
    entry[NEWER] = undefined; // D --x
    entry[OLDER] = this.newest; // D. --> E
    if (this.newest) {
      this.newest[NEWER] = entry; // E. <-- D
    }
    this.newest = entry;
  }

  assign(entries: Iterable<[K, V]>) {
    let entry,
      limit = this.limit || Number.MAX_VALUE;
    this._keymap.clear();
    const it = entries[Symbol.iterator]();
    for (let itv = it.next(); !itv.done; itv = it.next()) {
      const e = new Entry(itv.value[0], itv.value[1]);
      this._keymap.set(e.key, e);
      if (!entry) {
        this.oldest = e;
      } else {
        entry[NEWER] = e;
        e[OLDER] = entry;
      }
      entry = e;
      if (limit-- == 0) {
        throw new Error("overflow");
      }
    }
    this.newest = entry;
    this.size = this._keymap.size;
  }

  incognitoGet(key: K): V | void {
    // First, find our cache entry
    const entry = this._keymap.get(key);
    if (!entry) return; // Not cached. Sorry.

    return entry.value;
  }

  get(key: K): V | void {
    // First, find our cache entry
    const entry = this._keymap.get(key);
    if (!entry) return; // Not cached. Sorry.
    // As <key> was found in the cache, register it as being requested recently
    this._markEntryAsUsed(entry);
    return entry.value;
  }

  set(key: K, value: V) {
    let entry = this._keymap.get(key);

    if (entry) {
      // update existing
      entry.value = value;
      this._markEntryAsUsed(entry);
      return this;
    }

    // new entry
    this._keymap.set(key, (entry = new Entry(key, value)));

    if (this.newest) {
      // link previous tail to the new tail (entry)
      this.newest[NEWER] = entry;
      entry[OLDER] = this.newest;
    } else {
      // we're first in -- yay
      this.oldest = entry;
    }

    // add new entry to the end of the linked list -- it's now the freshest entry.
    this.newest = entry;
    ++this.size;
    if (this.size > this.limit) {
      // we hit the limit -- remove the head
      this.shift();
    }

    return this;
  }

  shift() {
    // todo: handle special case when limit == 1
    const entry = this.oldest;
    if (entry) {
      if (this.oldest?.[NEWER]) {
        // advance the list
        this.oldest = this.oldest[NEWER];
        this.oldest[OLDER] = undefined;
      } else {
        // the cache is exhausted
        this.oldest = undefined;
        this.newest = undefined;
      }
      // Remove last strong reference to <entry> and remove links from the purged
      // entry being returned:
      entry[NEWER] = entry[OLDER] = undefined;

      (entry.value as any)["__destory"]?.(entry.key, entry.value);

      this._keymap.delete(entry.key);

      --this.size;
      return [entry.key, entry.value];
    }
  }

  delete(key: K) {
    const entry = this._keymap.get(key);
    if (!entry) return;
    this._keymap.delete(entry.key);
    if (entry[NEWER] && entry[OLDER]) {
      // relink the older entry with the newer entry
      entry[OLDER][NEWER] = entry[NEWER];
      entry[NEWER][OLDER] = entry[OLDER];
    } else if (entry[NEWER]) {
      // remove the link to us
      entry[NEWER][OLDER] = undefined;
      // link the newer entry to head
      this.oldest = entry[NEWER];
    } else if (entry[OLDER]) {
      // remove the link to us
      entry[OLDER][NEWER] = undefined;
      // link the newer entry to head
      this.newest = entry[OLDER];
    } else {
      // if(entry[OLDER] === undefined && entry.newer === undefined) {
      this.oldest = this.newest = undefined;
    }

    this.size--;
    return entry.value;
  }

  clear() {
    // Not clearing links should be safe, as we don't expose live links to user
    this.oldest = this.newest = undefined;
    this.size = 0;
    this._keymap.clear();
  }
}

class Entry<K, V> {
  key: K;
  value: V;

  [NEWER]: Entry<K, V> | undefined;
  [OLDER]: Entry<K, V> | undefined;
  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
    this[NEWER] = undefined;
    this[OLDER] = undefined;
  }
}

export default LRUMap;
