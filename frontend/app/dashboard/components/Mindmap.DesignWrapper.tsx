import React from 'react'

interface MindmapDesignWrapperProps {
  children: React.ReactNode
}

export default function MindmapDesignWrapper(props: MindmapDesignWrapperProps) {
  const { children } = props
  return (
    <>
      {children}
    </>
  )
}
