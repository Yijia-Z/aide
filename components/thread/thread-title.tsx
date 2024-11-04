import React from 'react';
import { Thread as ThreadType } from '../types';

interface ThreadTitleProps {
  title: string;
  onEdit?: (newTitle: string) => void;
  isEditing?: boolean;
}

const ThreadTitle: React.FC<ThreadTitleProps> = ({ title, onEdit, isEditing = false }) => {
  const [editedTitle, setEditedTitle] = React.useState(title);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onEdit) {
      onEdit(editedTitle);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={editedTitle}
          onChange={handleTitleChange}
          className="border border-gray-300 rounded px-2 py-1"
        />
        <button type="submit" className="ml-2 bg-blue-500 text-white px-2 py-1 rounded">
          Save
        </button>
      </form>
    );
  }

  return <h2 className="text-xl font-bold">{title}</h2>;
};

export default ThreadTitle;