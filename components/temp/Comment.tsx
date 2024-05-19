// components/Comment.tsx
import { FC } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Comment as CommentType } from '../../app/thread';

interface CommentProps {
    comment: CommentType;
}

const Comment: FC<CommentProps> = ({ comment }) => (
    <Card>
        <CardHeader>
            <CardContent>{comment.author}</CardContent>
            <CardContent>{new Date(comment.timestamp).toLocaleString()}</CardContent>
        </CardHeader>
        <CardContent>{comment.text}</CardContent>
        <CardFooter>
            <Button>Upvote</Button>
            <Button>Downvote</Button>
            <Button>Reply</Button>
        </CardFooter>
        {comment.replies.map((reply) => (
            <div key={reply.id} style={{ marginLeft: '20px' }}>
                <Comment comment={reply} />
            </div>
        ))}
    </Card>
);

export default Comment;