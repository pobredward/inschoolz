import React, { useState, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Lucide 아이콘 목록에서 특수 객체 제외
const iconList = Object.entries(LucideIcons)
  .filter(([name]) => 
    name !== 'createLucideIcon' && 
    name !== 'default' && 
    !name.startsWith('__')
  )
  .map(([name, Icon]) => ({ name, Icon }));

// 카테고리 그룹화 (단순화를 위해 몇 가지만 정의)
const categories: { [key: string]: string[] } = {
  '일반': ['Home', 'User', 'Settings', 'Mail', 'Bell', 'Calendar', 'Search', 'Info'],
  '인터페이스': ['Menu', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight', 'X', 'Check', 'Plus', 'Minus'],
  '통신': ['MessageSquare', 'MessageCircle', 'Mail', 'Phone', 'Share', 'Send'],
  '파일': ['File', 'FileText', 'Image', 'Video', 'Music', 'Download', 'Upload'],
  '소셜': ['Users', 'UserPlus', 'Heart', 'Star', 'ThumbsUp', 'Award'],
  '비즈니스': ['BarChart', 'PieChart', 'TrendingUp', 'DollarSign', 'CreditCard'],
  '기타': [] // 위 카테고리에 없는 모든 아이콘
};

// 카테고리에 아이콘 할당
const categorizedIcons: { [key: string]: typeof iconList } = iconList.reduce((acc, icon) => {
  let assigned = false;
  
  Object.entries(categories).forEach(([category, iconNames]) => {
    if (iconNames.includes(icon.name)) {
      if (!acc[category]) acc[category] = [];
      acc[category].push(icon);
      assigned = true;
    }
  });
  
  if (!assigned) {
    if (!acc['기타']) acc['기타'] = [];
    acc['기타'].push(icon);
  }
  
  return acc;
}, {} as { [key: string]: typeof iconList });

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  customImageUrl?: string;
  onCustomImageChange?: (url: string) => void;
}

export function IconPicker({ 
  value, 
  onChange, 
  customImageUrl, 
  onCustomImageChange 
}: IconPickerProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'icon' | 'image'>('icon');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 선택된 아이콘 컴포넌트
  const SelectedIcon = value ? LucideIcons[value as keyof typeof LucideIcons] as any : null;

  // 아이콘 검색 기능
  const filteredIcons = search 
    ? iconList.filter(icon => 
        icon.name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // 이미지 업로드 핸들러
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCustomImageChange) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onCustomImageChange(event.target.result as string);
          setSelectedTab('image');
          setOpen(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-20"
          >
            <div className="flex items-center gap-2">
              {selectedTab === 'icon' && SelectedIcon ? (
                <SelectedIcon className="h-6 w-6" />
              ) : customImageUrl ? (
                <img 
                  src={customImageUrl} 
                  alt="Custom icon" 
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div className="h-10 w-10 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                  <LucideIcons.Image className="h-5 w-5" />
                </div>
              )}
              <span>
                {selectedTab === 'icon' && value ? value : '아이콘 선택'}
              </span>
            </div>
            <LucideIcons.ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Tabs defaultValue="icon" value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'icon' | 'image')}>
            <div className="flex items-center px-3 pt-3">
              <TabsList className="w-full">
                <TabsTrigger value="icon" className="flex-1">Lucide 아이콘</TabsTrigger>
                <TabsTrigger value="image" className="flex-1">이미지 업로드</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="icon" className="p-0">
              <div className="p-3">
                <Input
                  placeholder="아이콘 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
              </div>
              
              <Separator />
              
              <ScrollArea className="h-[300px]">
                {search ? (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {filteredIcons.map(({ name, Icon }) => {
                      const IconComponent = Icon as any;
                      return (
                        <Button
                          key={name}
                          variant="ghost"
                          className={cn(
                            "h-12 w-full p-0 justify-center items-center",
                            value === name && "bg-muted"
                          )}
                          onClick={() => {
                            onChange(name);
                            setOpen(false);
                          }}
                        >
                          <IconComponent className="h-5 w-5" />
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 space-y-4">
                    {Object.entries(categorizedIcons).map(([category, icons]) => (
                      <div key={category}>
                        <h3 className="text-sm font-medium mb-2">{category}</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {(icons as typeof iconList).map(({ name, Icon }) => {
                            const IconComponent = Icon as any;
                            return (
                              <Button
                                key={name}
                                variant="ghost"
                                className={cn(
                                  "h-12 w-full p-0 justify-center items-center",
                                  value === name && "bg-muted"
                                )}
                                onClick={() => {
                                  onChange(name);
                                  setOpen(false);
                                }}
                              >
                                <IconComponent className="h-5 w-5" />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="image" className="p-3 space-y-4">
              <div className="space-y-2">
                <Label>이미지 업로드</Label>
                <div 
                  className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <LucideIcons.Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">PNG, JPG 파일 업로드 (최대 1MB)</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/png,image/jpeg" 
                    className="hidden" 
                    onChange={handleImageUpload}
                  />
                </div>
                
                {customImageUrl && (
                  <div className="mt-4 flex flex-col items-center">
                    <p className="text-sm font-medium mb-2">현재 이미지</p>
                    <img 
                      src={customImageUrl} 
                      alt="Uploaded icon" 
                      className="h-20 w-20 object-contain border rounded"
                    />
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => {
                        if (onCustomImageChange) {
                          onCustomImageChange('');
                          setSelectedTab('icon');
                        }
                      }}
                    >
                      이미지 삭제
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
} 