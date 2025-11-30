// functions/[[path]].ts
// 这个文件处理根目录的文件访问,同时保持 WebDAV 和管理界面正常工作

export const onRequest: PagesFunction<{
  BUCKET: R2Bucket;
}> = async function (context) {
  const request = context.request;
  const url = new URL(request.url);
  const pathname = url.pathname;

  console.log(`[Root Handler] 请求路径: ${pathname}`);

  // ========================================
  // 跳过这些路径,让 TWO 系统处理
  // ========================================
  
  const skipPaths = [
    '/',                    // 首页 - TWO 管理界面
    '/favicon.ico',         // 网站图标
    '/robots.txt',          // robots
  ];

  const skipPrefixes = [
    '/webdav/',             // WebDAV 接口(重要!)
    '/api/',                // API
    '/assets/',             // 静态资源
    '/static/',             // 静态文件  
    '/_next/',              // Next.js
    '/build/',              // Docusaurus 构建文件
    '/img/',                // 图片资源
    '/css/',                // CSS
    '/js/',                 // JS
    '/fonts/',              // 字体
  ];

  // 检查是否需要跳过
  if (skipPaths.includes(pathname)) {
    console.log(`[Root Handler] 跳过: ${pathname}`);
    return context.next();
  }

  for (const prefix of skipPrefixes) {
    if (pathname.startsWith(prefix)) {
      console.log(`[Root Handler] 跳过: ${pathname} (匹配 ${prefix})`);
      return context.next();
    }
  }

  // 如果路径没有文件扩展名且不以 / 结尾,可能是页面路由
  const hasExtension = pathname.includes('.') && !pathname.endsWith('/');
  if (!hasExtension) {
    console.log(`[Root Handler] 跳过: ${pathname} (可能是页面路由)`);
    return context.next();
  }

  // ========================================
  // 尝试从 R2 获取文件
  // ========================================
  
  const bucket = context.env.BUCKET;
  
  if (!bucket) {
    console.error('[Root Handler] R2 bucket 未绑定');
    return new Response('配置错误: R2 bucket 未绑定', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  try {
    // 移除开头的 /
    const objectKey = pathname.substring(1);
    
    console.log(`[Root Handler] 尝试从 R2 获取: ${objectKey}`);
    
    // 从 R2 获取文件
    const object = await bucket.get(objectKey);

    if (!object) {
      console.log(`[Root Handler] 文件不存在: ${objectKey}`);
      
      // 文件不存在,交给 TWO 的 404 处理
      return context.next();
    }

    console.log(`[Root Handler] 成功获取文件: ${objectKey}, 大小: ${object.size} 字节`);

    // 构建响应头
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('Access-Control-Allow-Origin', '*');

    // 返回文件内容
    return new Response(object.body, {
      status: 200,
      headers: headers,
    });

  } catch (error: any) {
    console.error(`[Root Handler] 错误: ${error.message}`);
    
    // 出错了,交给 TWO 处理
    return context.next();
  }
};
