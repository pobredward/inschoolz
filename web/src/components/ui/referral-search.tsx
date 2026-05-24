"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchUsers } from '@/lib/api/users';
import { Search, X, User } from 'lucide-react';

interface ReferralUser {
  uid: string;
  userName: string;
  realName: string;
}

interface ReferralSearchProps {
  value?: string;
  onSelect: (user: ReferralUser | null) => void;
  placeholder?: string;
  className?: string;
}

export const ReferralSearch: React.FC<ReferralSearchProps> = ({
  value = '',
  onSelect,
  placeholder = "추천인 아이디 검색",
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [searchResults, setSearchResults] = useState<ReferralUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ReferralUser | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 디바운싱된 검색
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await searchUsers(searchTerm);
          setSearchResults(results);
          setIsOpen(true);
        } catch (error) {
          console.error('검색 오류:', error);
          setSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // 선택된 사용자가 있고 입력값이 변경되면 선택 해제
    if (selectedUser && newValue !== selectedUser.userName) {
      setSelectedUser(null);
      onSelect(null);
    }
  };

  const handleUserSelect = (user: ReferralUser) => {
    setSelectedUser(user);
    setSearchTerm(user.userName);
    setIsOpen(false);
    onSelect(user);
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedUser(null);
    setSearchResults([]);
    setIsOpen(false);
    onSelect(null);
  };

  const maskRealName = (realName: string): string => {
    if (realName.length <= 1) return realName;
    if (realName.length === 2) return realName.charAt(0) + '*';
    return realName.charAt(0) + '*'.repeat(realName.length - 2) + realName.charAt(realName.length - 1);
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`pr-20 ${selectedUser ? 'border-green-500' : ''}`}
        />
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
          )}
          
          {selectedUser && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          <Search className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* 선택된 사용자 표시 */}
      {selectedUser && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
          <User className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700">
            선택됨: <strong>{selectedUser.userName}</strong> ({maskRealName(selectedUser.realName)})
          </span>
        </div>
      )}

      {/* 검색 결과 드롭다운 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {searchResults.length > 0 ? (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b">
                검색 결과 ({searchResults.length}개)
              </div>
              {searchResults.map((user) => (
                <button
                  key={user.uid}
                  type="button"
                  onClick={() => handleUserSelect(user)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b last:border-b-0"
                >
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium text-sm">{user.userName}</div>
                    <div className="text-xs text-gray-500">
                      {maskRealName(user.realName)}
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : searchTerm.trim().length >= 2 && !isLoading ? (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              검색 결과가 없습니다
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}; 