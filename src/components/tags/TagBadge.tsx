import { Tag } from '@/hooks/useTags';

interface Props {
  tag: Tag;
}

export const TagBadge = ({ tag }: Props) => {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium leading-4 whitespace-nowrap"
      style={{ 
        backgroundColor: `${tag.color}20`, 
        color: tag.color,
        border: `1px solid ${tag.color}40`
      }}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
};
