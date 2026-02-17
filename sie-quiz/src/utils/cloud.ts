/**
 * 微信云开发 API 封装
 * 提供数据库、云函数、云存储的统一调用接口
 */

// 获取云开发数据库实例
function getDB() {
  return wx.cloud.database();
}

/** 数据库操作 */
export const db = {
  /** 获取集合引用 */
  collection(name: string) {
    return getDB().collection(name);
  },

  /** 查询文档 */
  async get<T = any>(collection: string, where: Record<string, any> = {}) {
    const res = await getDB().collection(collection).where(where).get();
    return res.data as T[];
  },

  /** 添加文档 */
  async add(collection: string, data: Record<string, any>) {
    const res = await getDB().collection(collection).add({ data });
    return res._id;
  },

  /** 更新文档 */
  async update(collection: string, docId: string, data: Record<string, any>) {
    const res = await getDB().collection(collection).doc(docId).update({ data });
    return res.stats;
  },

  /** 删除文档 */
  async remove(collection: string, docId: string) {
    const res = await getDB().collection(collection).doc(docId).remove();
    return res.stats;
  },

  /** 获取服务端时间戳 */
  serverDate() {
    return getDB().serverDate();
  },

  /** 获取命令对象（用于 inc、push 等原子操作） */
  command() {
    return getDB().command;
  },
};

/** 云函数调用 */
export async function callFunction<T = any>(name: string, data: Record<string, any> = {}) {
  const res = await wx.cloud.callFunction({ name, data });
  return res.result as T;
}

/** 云存储操作 */
export const storage = {
  /** 上传文件 */
  async upload(cloudPath: string, filePath: string) {
    const res = await wx.cloud.uploadFile({ cloudPath, filePath });
    return res.fileID;
  },

  /** 下载文件 */
  async download(fileID: string) {
    const res = await wx.cloud.downloadFile({ fileID });
    return res.tempFilePath;
  },

  /** 获取临时链接 */
  async getTempURL(fileList: string[]) {
    const res = await wx.cloud.getTempFileURL({ fileList });
    return res.fileList;
  },

  /** 删除文件 */
  async remove(fileList: string[]) {
    const res = await wx.cloud.deleteFile({ fileList });
    return res.fileList;
  },
};
