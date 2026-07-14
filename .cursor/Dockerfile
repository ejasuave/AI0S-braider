# 1. Use the official lightweight Node.js image
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy your package files first (helps with faster build caching)
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
# If you have subfolders/packages, copy them too:
COPY . .

# 4. Install all dependencies and build the project
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm build

# 5. Expose the port your app runs on
EXPOSE 3000

# 6. Command to run your production server
CMD [ "pnpm", "start" ]