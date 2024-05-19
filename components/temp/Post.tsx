// components/Post.tsx
import { FC } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Comment as CommentType } from '../../app/thread';
import Comment from './Comment';

interface PostProps {
    post: CommentType;
}

const Post: FC<PostProps> = ({ post }) => (
    <Card>
        <CardHeader>
            <CardTitle>{post.author}</CardTitle>
            <CardDescription>{new Date(post.timestamp).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent>
            <p>{post.text}</p>
        </CardContent>
        <CardFooter>
            <Button>Reply</Button>
        </CardFooter>
        {post.replies.map((reply) => (
            <div style={{ marginLeft: '20px' }} key={reply.id}>
                <Comment comment={reply} />
            </div>
        ))}
    </Card>
);

export default Post;