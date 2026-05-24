"use client";

import React from 'react';
import { PostViewClientFast } from '@/components/board/PostViewClientFast';

interface FastRegionalPostPageProps {
  params: Promise<{
    sido: string;
    sigungu: string;
    boardCode: string;
    postId: string;
  }>;
}

export default function FastRegionalPostPage({ params }: FastRegionalPostPageProps) {
  const wrappedParams = params.then(p => ({
    ...p,
    type: 'regional' as const
  }));

  return <PostViewClientFast params={wrappedParams} />;
}
