"use client";

import React from 'react';
import { PostViewClientFast } from '@/components/board/PostViewClientFast';

interface FastSchoolPostPageProps {
  params: Promise<{
    schoolId: string;
    boardCode: string;
    postId: string;
  }>;
}

export default function FastSchoolPostPage({ params }: FastSchoolPostPageProps) {
  const wrappedParams = params.then(p => ({
    ...p,
    type: 'school' as const
  }));

  return <PostViewClientFast params={wrappedParams} />;
}
