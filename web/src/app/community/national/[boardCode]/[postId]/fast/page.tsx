"use client";

import React from 'react';
import { PostViewClientFast } from '@/components/board/PostViewClientFast';

interface FastNationalPostPageProps {
  params: Promise<{
    boardCode: string;
    postId: string;
  }>;
}

export default function FastNationalPostPage({ params }: FastNationalPostPageProps) {
  const wrappedParams = params.then(p => ({
    ...p,
    type: 'national' as const
  }));

  return <PostViewClientFast params={wrappedParams} />;
}
